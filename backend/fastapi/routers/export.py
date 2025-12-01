from fastapi import APIRouter, HTTPException, Query, Depends, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
import csv
import json
import io
import zipfile
import os
from pathlib import Path

from database import get_db
from config import settings

router = APIRouter()

class ExportRequest(BaseModel):
    """Export request parameters"""
    case_id: Optional[int] = Field(None, description="Filter by case ID")
    document_ids: Optional[List[int]] = Field(None, description="Specific document IDs to export")
    format: str = Field("csv", description="Export format: csv, json, xlsx")
    include_metadata: bool = Field(True, description="Include metadata in export")
    date_from: Optional[datetime] = Field(None, description="Filter by date from")
    date_to: Optional[datetime] = Field(None, description="Filter by date to")

class ExportJob(BaseModel):
    """Export job status"""
    job_id: str
    status: str  # pending, processing, completed, failed
    format: str
    created_at: datetime
    completed_at: Optional[datetime]
    download_url: Optional[str]
    total_records: int
    error_message: Optional[str]

# In-memory job tracking (in production, use Redis or database)
export_jobs: Dict[str, ExportJob] = {}

@router.post("/documents", response_model=ExportJob)
async def export_documents(
    export_request: ExportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Export documents metadata and create downloadable file
    
    Supports formats:
    - CSV: Comma-separated values
    - JSON: JSON array of documents
    - XLSX: Excel spreadsheet
    """
    try:
        # Generate job ID
        job_id = f"export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}"
        
        # Create job record
        job = ExportJob(
            job_id=job_id,
            status="pending",
            format=export_request.format,
            created_at=datetime.utcnow(),
            completed_at=None,
            download_url=None,
            total_records=0,
            error_message=None
        )
        export_jobs[job_id] = job
        
        # Start background task
        background_tasks.add_task(
            process_export,
            job_id,
            export_request,
            db
        )
        
        return job
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

async def process_export(job_id: str, export_request: ExportRequest, db: Session):
    """Background task to process export"""
    try:
        # Update job status
        export_jobs[job_id].status = "processing"
        
        # Build query
        sql_parts = [
            """
            SELECT 
                d.id,
                d.filename,
                d.case_id,
                c.name as case_name,
                c.number as case_number,
                d.file_type,
                d.file_size,
                d.upload_date,
                d.uploaded_by,
                d.metadata,
                d.tags,
                d.hash
            FROM documents d
            LEFT JOIN cases c ON d.case_id = c.id
            WHERE 1=1
            """
        ]
        
        params = {}
        
        if export_request.case_id:
            sql_parts.append("AND d.case_id = :case_id")
            params["case_id"] = export_request.case_id
            
        if export_request.document_ids:
            placeholders = ",".join([f":id_{i}" for i in range(len(export_request.document_ids))])
            sql_parts.append(f"AND d.id IN ({placeholders})")
            for i, doc_id in enumerate(export_request.document_ids):
                params[f"id_{i}"] = doc_id
                
        if export_request.date_from:
            sql_parts.append("AND d.upload_date >= :date_from")
            params["date_from"] = export_request.date_from
            
        if export_request.date_to:
            sql_parts.append("AND d.upload_date <= :date_to")
            params["date_to"] = export_request.date_to
        
        sql_parts.append("ORDER BY d.upload_date DESC")
        
        # Execute query
        query = text(" ".join(sql_parts))
        result = db.execute(query, params)
        rows = result.fetchall()
        
        # Create export directory if it doesn't exist
        export_dir = Path(settings.export_dir)
        export_dir.mkdir(exist_ok=True)
        
        # Generate export file
        filename = f"{job_id}.{export_request.format}"
        filepath = export_dir / filename
        
        if export_request.format == "csv":
            with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile)
                
                # Headers
                headers = [
                    "ID", "Filename", "Case ID", "Case Name", "Case Number",
                    "File Type", "File Size (bytes)", "Upload Date", "Uploaded By"
                ]
                if export_request.include_metadata:
                    headers.extend(["Metadata", "Tags", "Hash"])
                writer.writerow(headers)
                
                # Data
                for row in rows:
                    data = list(row[:9])
                    if export_request.include_metadata:
                        data.extend([
                            json.dumps(row[9]) if row[9] else "",
                            json.dumps(row[10]) if row[10] else "",
                            row[11] or ""
                        ])
                    writer.writerow(data)
                    
        elif export_request.format == "json":
            documents = []
            for row in rows:
                doc = {
                    "id": row[0],
                    "filename": row[1],
                    "case_id": row[2],
                    "case_name": row[3],
                    "case_number": row[4],
                    "file_type": row[5],
                    "file_size": row[6],
                    "upload_date": row[7].isoformat() if row[7] else None,
                    "uploaded_by": row[8]
                }
                if export_request.include_metadata:
                    doc.update({
                        "metadata": row[9],
                        "tags": row[10],
                        "hash": row[11]
                    })
                documents.append(doc)
            
            with open(filepath, 'w', encoding='utf-8') as jsonfile:
                json.dump({
                    "export_date": datetime.utcnow().isoformat(),
                    "total_records": len(documents),
                    "documents": documents
                }, jsonfile, indent=2)
        
        elif export_request.format == "xlsx":
            try:
                import pandas as pd
                
                # Convert to DataFrame
                data = []
                for row in rows:
                    record = {
                        "ID": row[0],
                        "Filename": row[1],
                        "Case ID": row[2],
                        "Case Name": row[3],
                        "Case Number": row[4],
                        "File Type": row[5],
                        "File Size (bytes)": row[6],
                        "Upload Date": row[7],
                        "Uploaded By": row[8]
                    }
                    if export_request.include_metadata:
                        record.update({
                            "Metadata": json.dumps(row[9]) if row[9] else "",
                            "Tags": json.dumps(row[10]) if row[10] else "",
                            "Hash": row[11] or ""
                        })
                    data.append(record)
                
                df = pd.DataFrame(data)
                df.to_excel(filepath, index=False, engine='openpyxl')
                
            except ImportError:
                raise Exception("pandas and openpyxl required for XLSX export")
        
        # Update job status
        export_jobs[job_id].status = "completed"
        export_jobs[job_id].completed_at = datetime.utcnow()
        export_jobs[job_id].download_url = f"/api/export/download/{job_id}"
        export_jobs[job_id].total_records = len(rows)
        
    except Exception as e:
        export_jobs[job_id].status = "failed"
        export_jobs[job_id].error_message = str(e)

@router.get("/job/{job_id}", response_model=ExportJob)
async def get_export_job(job_id: str):
    """Get export job status"""
    if job_id not in export_jobs:
        raise HTTPException(status_code=404, detail="Export job not found")
    
    return export_jobs[job_id]

@router.get("/download/{job_id}")
async def download_export(job_id: str):
    """Download completed export file"""
    if job_id not in export_jobs:
        raise HTTPException(status_code=404, detail="Export job not found")
    
    job = export_jobs[job_id]
    
    if job.status != "completed":
        raise HTTPException(status_code=400, detail=f"Export not ready. Status: {job.status}")
    
    filepath = Path(settings.export_dir) / f"{job_id}.{job.format}"
    
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Export file not found")
    
    # Determine media type
    media_types = {
        "csv": "text/csv",
        "json": "application/json",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
    
    return FileResponse(
        path=filepath,
        media_type=media_types.get(job.format, "application/octet-stream"),
        filename=f"ediscovery_export_{datetime.utcnow().strftime('%Y%m%d')}.{job.format}"
    )

@router.get("/formats")
async def get_export_formats():
    """Get available export formats"""
    return {
        "formats": [
            {
                "id": "csv",
                "name": "CSV (Comma-Separated Values)",
                "extension": ".csv",
                "description": "Universal format, compatible with Excel and other tools"
            },
            {
                "id": "json",
                "name": "JSON",
                "extension": ".json",
                "description": "Structured data format, ideal for API integration"
            },
            {
                "id": "xlsx",
                "name": "Excel Spreadsheet",
                "extension": ".xlsx",
                "description": "Microsoft Excel format with formatting support"
            }
        ]
    }
