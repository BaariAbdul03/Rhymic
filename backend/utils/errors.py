from flask import jsonify

def register_error_handlers(app):
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"message": str(error.description if hasattr(error, 'description') else "Bad request")}), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({"message": "Unauthorized access"}), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({"message": "Access denied"}), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"message": "Resource not found"}), 404
        
    @app.errorhandler(429)
    def ratelimit_handler(error):
        return jsonify({"message": "Rate limit exceeded. Please try again later."}), 429

    @app.errorhandler(500)
    def internal_server_error(error):
        # Log the error here in a real app
        print(f"Server Error: {error}")
        return jsonify({"message": "Internal server error"}), 500
