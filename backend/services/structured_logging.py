import logging
import sys
import json
from datetime import datetime
from flask import has_request_context, request
import traceback

class StructuredFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        if has_request_context():
            log_data["request"] = {
                "method": request.method,
                "path": request.path,
                "remote_addr": request.remote_addr,
                "user_agent": str(request.user_agent)
            }

        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info)
            }

        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id

        if hasattr(record, "extra"):
            log_data.update(record.extra)

        return json.dumps(log_data)

def setup_logging(app):
    # Remove default handlers
    app.logger.handlers.clear()
    
    # Console handler with structured output
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredFormatter())
    app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO)
    
    # Set werkzeug to WARNING to reduce noise
    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    
    return app.logger

def log_request(logger, response):
    """Log HTTP request details after response."""
    if has_request_context():
        logger.info(
            f"{request.method} {request.path} -> {response.status_code}",
            extra={
                "request": {
                    "method": request.method,
                    "path": request.path,
                    "status_code": response.status_code,
                    "remote_addr": request.remote_addr
                }
            }
        )
    return response