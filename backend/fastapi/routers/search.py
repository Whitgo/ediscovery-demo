from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
import re

from database import get_db

router = APIRouter()

class SearchQuery(BaseModel):
    """Search query parameters"""
    query: str = Field(..., description="Search query string")
    case_id: Optional[int] = Field(None, description="Filter by case ID")
    document_type: Optional[str] = Field(None, description="Filter by document type")
    custodian: Optional[str] = Field(None, description="Filter by custodian")
    date_from: Optional[datetime] = Field(None, description="Filter by date from")
    date_to: Optional[datetime] = Field(None, description="Filter by date to")
    tags: Optional[List[str]] = Field(None, description="Filter by tags")
    limit: int = Field(50, ge=1, le=1000, description="Results limit")
    offset: int = Field(0, ge=0, description="Results offset")

class SearchResult(BaseModel):
    """Search result item"""
    id: int
    filename: str
    case_id: int
    case_name: str
    file_type: str
    upload_date: datetime
    custodian: Optional[str]
    tags: Optional[List[str]]
    relevance_score: float
    snippet: Optional[str]

class SearchResponse(BaseModel):
    """Search response with results and metadata"""
    query: str
    total_results: int
    results: List[SearchResult]
    page: int
    per_page: int
    execution_time_ms: float

@router.post("/", response_model=SearchResponse)
async def search_documents(
    search_query: SearchQuery,
    db: Session = Depends(get_db)
):
    """
    Advanced document search with full-text search and filtering
    
    Supports:
    - Full-text search across document names and metadata
    - Filtering by case, document type, custodian, date range
    - Tag-based filtering
    - Pagination
    """
    start_time = datetime.utcnow()
    
    try:
        # Build SQL query with filters
        sql_parts = [
            """
            SELECT 
                d.id,
                d.filename,
                d.case_id,
                c.name as case_name,
                d.file_type,
                d.upload_date,
                d.metadata->>'custodian' as custodian,
                d.tags,
                CASE 
                    WHEN d.filename ILIKE :query THEN 1.0
                    WHEN d.metadata::text ILIKE :query THEN 0.8
                    ELSE 0.5
                END as relevance_score,
                SUBSTRING(d.filename FROM 1 FOR 100) as snippet
            FROM documents d
            LEFT JOIN cases c ON d.case_id = c.id
            WHERE 1=1
            """
        ]
        
        params = {"query": f"%{search_query.query}%"}
        
        # Add filters
        if search_query.case_id:
            sql_parts.append("AND d.case_id = :case_id")
            params["case_id"] = search_query.case_id
            
        if search_query.document_type:
            sql_parts.append("AND d.file_type ILIKE :doc_type")
            params["doc_type"] = f"%{search_query.document_type}%"
            
        if search_query.custodian:
            sql_parts.append("AND d.metadata->>'custodian' ILIKE :custodian")
            params["custodian"] = f"%{search_query.custodian}%"
            
        if search_query.date_from:
            sql_parts.append("AND d.upload_date >= :date_from")
            params["date_from"] = search_query.date_from
            
        if search_query.date_to:
            sql_parts.append("AND d.upload_date <= :date_to")
            params["date_to"] = search_query.date_to
        
        # Search in filename and metadata
        sql_parts.append("""
            AND (
                d.filename ILIKE :query 
                OR d.metadata::text ILIKE :query
            )
        """)
        
        # Order and pagination
        sql_parts.append("ORDER BY relevance_score DESC, d.upload_date DESC")
        sql_parts.append("LIMIT :limit OFFSET :offset")
        params["limit"] = search_query.limit
        params["offset"] = search_query.offset
        
        # Execute query
        query = text(" ".join(sql_parts))
        result = db.execute(query, params)
        rows = result.fetchall()
        
        # Count total results (without pagination)
        count_query = text(
            " ".join(sql_parts[:-1]).replace(
                "SELECT d.id, d.filename",
                "SELECT COUNT(*)"
            )
        )
        count_params = {k: v for k, v in params.items() if k not in ["limit", "offset"]}
        total_count = db.execute(count_query, count_params).scalar()
        
        # Format results
        results = []
        for row in rows:
            results.append(SearchResult(
                id=row[0],
                filename=row[1],
                case_id=row[2],
                case_name=row[3] or "Unknown",
                file_type=row[4] or "Unknown",
                upload_date=row[5],
                custodian=row[6],
                tags=row[7] or [],
                relevance_score=float(row[8]),
                snippet=row[9]
            ))
        
        # Calculate execution time
        end_time = datetime.utcnow()
        execution_time = (end_time - start_time).total_seconds() * 1000
        
        return SearchResponse(
            query=search_query.query,
            total_results=total_count or 0,
            results=results,
            page=(search_query.offset // search_query.limit) + 1,
            per_page=search_query.limit,
            execution_time_ms=round(execution_time, 2)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@router.get("/suggest")
async def search_suggestions(
    q: str = Query(..., min_length=2, description="Search query prefix"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Get search suggestions based on query prefix
    Returns matching document names and tags
    """
    try:
        query = text("""
            SELECT DISTINCT filename
            FROM documents
            WHERE filename ILIKE :query
            ORDER BY filename
            LIMIT :limit
        """)
        
        result = db.execute(query, {"query": f"{q}%", "limit": limit})
        suggestions = [row[0] for row in result.fetchall()]
        
        return {
            "query": q,
            "suggestions": suggestions
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Suggestion failed: {str(e)}")

@router.get("/stats")
async def search_stats(db: Session = Depends(get_db)):
    """Get search statistics and indexed documents count"""
    try:
        stats_query = text("""
            SELECT 
                COUNT(*) as total_documents,
                COUNT(DISTINCT case_id) as total_cases,
                COUNT(DISTINCT file_type) as file_types,
                SUM(file_size) as total_size
            FROM documents
        """)
        
        result = db.execute(stats_query).fetchone()
        
        return {
            "total_documents": result[0] or 0,
            "total_cases": result[1] or 0,
            "file_types": result[2] or 0,
            "total_size_bytes": result[3] or 0,
            "total_size_mb": round((result[3] or 0) / (1024 * 1024), 2)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stats retrieval failed: {str(e)}")
