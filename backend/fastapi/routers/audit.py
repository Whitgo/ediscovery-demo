from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db

router = APIRouter()

class AuditLogEntry(BaseModel):
    """Audit log entry"""
    id: int
    timestamp: datetime
    user_id: int
    username: str
    action: str
    resource_type: str
    resource_id: Optional[int]
    details: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    user_agent: Optional[str]
    status: str

class AuditLogResponse(BaseModel):
    """Audit log response"""
    total_records: int
    logs: List[AuditLogEntry]
    page: int
    per_page: int
    filters_applied: Dict[str, Any]

class AuditStats(BaseModel):
    """Audit statistics"""
    total_events: int
    events_by_action: Dict[str, int]
    events_by_user: Dict[str, int]
    events_by_status: Dict[str, int]
    recent_activity: List[AuditLogEntry]
    time_range: str

@router.get("/logs", response_model=AuditLogResponse)
async def get_audit_logs(
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    resource_id: Optional[int] = Query(None, description="Filter by resource ID"),
    status: Optional[str] = Query(None, description="Filter by status (success/failure)"),
    date_from: Optional[datetime] = Query(None, description="Filter by date from"),
    date_to: Optional[datetime] = Query(None, description="Filter by date to"),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Retrieve audit logs with advanced filtering
    
    Supports filtering by:
    - User ID and username
    - Action type (login, upload, delete, etc.)
    - Resource type (case, document, user, etc.)
    - Resource ID
    - Status (success/failure)
    - Date range
    """
    try:
        # Build query
        sql_parts = [
            """
            SELECT 
                al.id,
                al.timestamp,
                al.user_id,
                u.email as username,
                al.action,
                al.resource_type,
                al.resource_id,
                al.details,
                al.ip_address,
                al.user_agent,
                al.status
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
            """
        ]
        
        params = {}
        filters_applied = {}
        
        # Add filters
        if user_id:
            sql_parts.append("AND al.user_id = :user_id")
            params["user_id"] = user_id
            filters_applied["user_id"] = user_id
            
        if action:
            sql_parts.append("AND al.action = :action")
            params["action"] = action
            filters_applied["action"] = action
            
        if resource_type:
            sql_parts.append("AND al.resource_type = :resource_type")
            params["resource_type"] = resource_type
            filters_applied["resource_type"] = resource_type
            
        if resource_id:
            sql_parts.append("AND al.resource_id = :resource_id")
            params["resource_id"] = resource_id
            filters_applied["resource_id"] = resource_id
            
        if status:
            sql_parts.append("AND al.status = :status")
            params["status"] = status
            filters_applied["status"] = status
            
        if date_from:
            sql_parts.append("AND al.timestamp >= :date_from")
            params["date_from"] = date_from
            filters_applied["date_from"] = date_from.isoformat()
            
        if date_to:
            sql_parts.append("AND al.timestamp <= :date_to")
            params["date_to"] = date_to
            filters_applied["date_to"] = date_to.isoformat()
        
        # Order and pagination
        sql_parts.append("ORDER BY al.timestamp DESC")
        sql_parts.append("LIMIT :limit OFFSET :offset")
        params["limit"] = limit
        params["offset"] = offset
        
        # Execute query
        query = text(" ".join(sql_parts))
        result = db.execute(query, params)
        rows = result.fetchall()
        
        # Count total
        count_query = text(
            " ".join(sql_parts[:-1]).replace(
                "SELECT al.id, al.timestamp",
                "SELECT COUNT(*)"
            )
        )
        count_params = {k: v for k, v in params.items() if k not in ["limit", "offset"]}
        total_count = db.execute(count_query, count_params).scalar()
        
        # Format results
        logs = []
        for row in rows:
            logs.append(AuditLogEntry(
                id=row[0],
                timestamp=row[1],
                user_id=row[2],
                username=row[3] or "Unknown",
                action=row[4],
                resource_type=row[5] or "unknown",
                resource_id=row[6],
                details=row[7] or {},
                ip_address=row[8],
                user_agent=row[9],
                status=row[10] or "unknown"
            ))
        
        return AuditLogResponse(
            total_records=total_count or 0,
            logs=logs,
            page=(offset // limit) + 1,
            per_page=limit,
            filters_applied=filters_applied
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit log retrieval failed: {str(e)}")

@router.get("/stats", response_model=AuditStats)
async def get_audit_stats(
    hours: int = Query(24, ge=1, le=8760, description="Time range in hours"),
    db: Session = Depends(get_db)
):
    """
    Get audit statistics for specified time range
    
    Returns:
    - Total events count
    - Events grouped by action type
    - Events grouped by user
    - Events grouped by status
    - Recent activity list
    """
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Total events
        total_query = text("""
            SELECT COUNT(*) 
            FROM audit_logs 
            WHERE timestamp >= :cutoff_time
        """)
        total_events = db.execute(total_query, {"cutoff_time": cutoff_time}).scalar()
        
        # Events by action
        action_query = text("""
            SELECT action, COUNT(*) as count
            FROM audit_logs
            WHERE timestamp >= :cutoff_time
            GROUP BY action
            ORDER BY count DESC
        """)
        action_result = db.execute(action_query, {"cutoff_time": cutoff_time})
        events_by_action = {row[0]: row[1] for row in action_result.fetchall()}
        
        # Events by user
        user_query = text("""
            SELECT u.email, COUNT(*) as count
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.timestamp >= :cutoff_time
            GROUP BY u.email
            ORDER BY count DESC
            LIMIT 10
        """)
        user_result = db.execute(user_query, {"cutoff_time": cutoff_time})
        events_by_user = {row[0] or "Unknown": row[1] for row in user_result.fetchall()}
        
        # Events by status
        status_query = text("""
            SELECT status, COUNT(*) as count
            FROM audit_logs
            WHERE timestamp >= :cutoff_time
            GROUP BY status
        """)
        status_result = db.execute(status_query, {"cutoff_time": cutoff_time})
        events_by_status = {row[0]: row[1] for row in status_result.fetchall()}
        
        # Recent activity
        recent_query = text("""
            SELECT 
                al.id,
                al.timestamp,
                al.user_id,
                u.email as username,
                al.action,
                al.resource_type,
                al.resource_id,
                al.details,
                al.ip_address,
                al.user_agent,
                al.status
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.timestamp >= :cutoff_time
            ORDER BY al.timestamp DESC
            LIMIT 10
        """)
        recent_result = db.execute(recent_query, {"cutoff_time": cutoff_time})
        
        recent_activity = []
        for row in recent_result.fetchall():
            recent_activity.append(AuditLogEntry(
                id=row[0],
                timestamp=row[1],
                user_id=row[2],
                username=row[3] or "Unknown",
                action=row[4],
                resource_type=row[5] or "unknown",
                resource_id=row[6],
                details=row[7] or {},
                ip_address=row[8],
                user_agent=row[9],
                status=row[10] or "unknown"
            ))
        
        return AuditStats(
            total_events=total_events or 0,
            events_by_action=events_by_action,
            events_by_user=events_by_user,
            events_by_status=events_by_status,
            recent_activity=recent_activity,
            time_range=f"Last {hours} hours"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit stats retrieval failed: {str(e)}")

@router.get("/actions")
async def get_audit_actions(db: Session = Depends(get_db)):
    """Get list of all audit action types"""
    try:
        query = text("""
            SELECT DISTINCT action
            FROM audit_logs
            ORDER BY action
        """)
        result = db.execute(query)
        actions = [row[0] for row in result.fetchall()]
        
        return {
            "actions": actions,
            "total": len(actions)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Action retrieval failed: {str(e)}")

@router.get("/resource-types")
async def get_resource_types(db: Session = Depends(get_db)):
    """Get list of all resource types"""
    try:
        query = text("""
            SELECT DISTINCT resource_type
            FROM audit_logs
            WHERE resource_type IS NOT NULL
            ORDER BY resource_type
        """)
        result = db.execute(query)
        resource_types = [row[0] for row in result.fetchall()]
        
        return {
            "resource_types": resource_types,
            "total": len(resource_types)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resource type retrieval failed: {str(e)}")

@router.get("/timeline")
async def get_audit_timeline(
    hours: int = Query(24, ge=1, le=8760),
    interval: str = Query("hour", description="Interval: hour, day, week"),
    db: Session = Depends(get_db)
):
    """
    Get audit event timeline with aggregated counts
    Useful for visualizing activity over time
    """
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Determine date_trunc interval
        trunc_interval = "hour" if interval == "hour" else "day"
        
        query = text(f"""
            SELECT 
                DATE_TRUNC(:interval, timestamp) as time_bucket,
                COUNT(*) as event_count,
                COUNT(DISTINCT user_id) as unique_users
            FROM audit_logs
            WHERE timestamp >= :cutoff_time
            GROUP BY time_bucket
            ORDER BY time_bucket DESC
        """)
        
        result = db.execute(query, {
            "interval": trunc_interval,
            "cutoff_time": cutoff_time
        })
        
        timeline = []
        for row in result.fetchall():
            timeline.append({
                "timestamp": row[0].isoformat(),
                "event_count": row[1],
                "unique_users": row[2]
            })
        
        return {
            "time_range": f"Last {hours} hours",
            "interval": interval,
            "data_points": len(timeline),
            "timeline": timeline
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Timeline retrieval failed: {str(e)}")
