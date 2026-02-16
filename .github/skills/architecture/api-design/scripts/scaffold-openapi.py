#!/usr/bin/env python3
"""Scaffold an OpenAPI 3.1 specification from endpoint definitions.

Generates a starter OpenAPI spec with proper structure, schemas, and examples.

Usage:
 python scaffold-openapi.py --name "My API" --version 1.0.0 --output openapi.yaml
 python scaffold-openapi.py --endpoints "GET /users, POST /users, GET /users/{id}"
"""

import argparse
import json
import sys
from pathlib import Path

def build_schema(name: str, properties: dict[str, str] | None = None) -> dict:
 """Build a JSON Schema object."""
 if not properties:
 properties = {"id": "integer", "name": "string", "created_at": "string"}
 
 schema = {
 "type": "object",
 "required": [k for k in properties if k != "id"],
 "properties": {},
 }
 for prop_name, prop_type in properties.items():
 prop_def: dict = {"type": prop_type}
 if prop_name == "id":
 prop_def["readOnly"] = True
 if prop_type == "string" and "date" in prop_name.lower():
 prop_def["format"] = "date-time"
 if prop_type == "string" and "email" in prop_name.lower():
 prop_def["format"] = "email"
 schema["properties"][prop_name] = prop_def
 return schema

def parse_endpoint(endpoint: str) -> tuple[str, str]:
 """Parse 'GET /users/{id}' into (method, path)."""
 parts = endpoint.strip().split(maxsplit=1)
 if len(parts) != 2:
 raise ValueError(f"Invalid endpoint format: '{endpoint}'. Use 'METHOD /path'")
 return parts[0].lower(), parts[1]

def infer_resource(path: str) -> str:
 """Infer resource name from path like /api/v1/users/{id} -> User."""
 segments = [s for s in path.split("/") if s and not s.startswith("{")]
 if segments:
 name = segments[-1].rstrip("s").capitalize()
 return name
 return "Resource"

def build_error_schema() -> dict:
 """RFC 7807 Problem Details schema."""
 return {
 "type": "object",
 "properties": {
 "type": {"type": "string", "format": "uri"},
 "title": {"type": "string"},
 "status": {"type": "integer"},
 "detail": {"type": "string"},
 "instance": {"type": "string", "format": "uri"},
 },
 "required": ["type", "title", "status"],
 }

def build_path_item(method: str, path: str, resource: str) -> dict:
 """Build an OpenAPI path item for a given method."""
 tag = resource + "s"
 
 path_params = []
 for segment in path.split("/"):
 if segment.startswith("{") and segment.endswith("}"):
 param_name = segment.strip("{}")
 path_params.append({
 "name": param_name,
 "in": "path",
 "required": True,
 "schema": {"type": "string" if param_name != "id" else "integer"},
 })

 operation: dict = {
 "tags": [tag],
 "operationId": f"{method}_{resource.lower()}{'_by_id' if path_params else '_list' if method == 'get' else ''}",
 "summary": f"{'List' if method =='get' and not path_params else method.capitalize()} {resource.lower()}",
 "responses": {},
 }

 if path_params:
 operation["parameters"] = path_params

 if method == "get" and not path_params:
 # List endpoint - add pagination
 operation["parameters"] = [
 {"name": "page", "in": "query", "schema": {"type": "integer", "default": 1, "minimum": 1}},
 {"name": "page_size", "in": "query", "schema": {"type": "integer", "default": 20, "minimum": 1, "maximum": 100}},
 ]
 operation["responses"]["200"] = {
 "description": f"List of {resource.lower()}s",
 "content": {
 "application/json": {
 "schema": {
 "type": "object",
 "properties": {
 "data": {"type": "array", "items": {"$ref": f"#/components/schemas/{resource}"}},
 "total": {"type": "integer"},
 "page": {"type": "integer"},
 "page_size": {"type": "integer"},
 },
 }
 }
 },
 }
 elif method == "get":
 operation["responses"]["200"] = {
 "description": f"{resource} found",
 "content": {"application/json": {"schema": {"$ref": f"#/components/schemas/{resource}"}}},
 }
 operation["responses"]["404"] = {
 "description": f"{resource} not found",
 "content": {"application/problem+json": {"schema": {"$ref": "#/components/schemas/ProblemDetails"}}},
 }
 elif method == "post":
 operation["requestBody"] = {
 "required": True,
 "content": {"application/json": {"schema": {"$ref": f"#/components/schemas/{resource}Create"}}},
 }
 operation["responses"]["201"] = {
 "description": f"{resource} created",
 "content": {"application/json": {"schema": {"$ref": f"#/components/schemas/{resource}"}}},
 "headers": {"Location": {"schema": {"type": "string", "format": "uri"}}},
 }
 operation["responses"]["400"] = {
 "description": "Validation error",
 "content": {"application/problem+json": {"schema": {"$ref": "#/components/schemas/ProblemDetails"}}},
 }
 elif method == "put" or method == "patch":
 operation["requestBody"] = {
 "required": True,
 "content": {"application/json": {"schema": {"$ref": f"#/components/schemas/{resource}Update"}}},
 }
 operation["responses"]["200"] = {
 "description": f"{resource} updated",
 "content": {"application/json": {"schema": {"$ref": f"#/components/schemas/{resource}"}}},
 }
 operation["responses"]["404"] = {
 "description": f"{resource} not found",
 "content": {"application/problem+json": {"schema": {"$ref": "#/components/schemas/ProblemDetails"}}},
 }
 elif method == "delete":
 operation["responses"]["204"] = {"description": f"{resource} deleted"}
 operation["responses"]["404"] = {
 "description": f"{resource} not found",
 "content": {"application/problem+json": {"schema": {"$ref": "#/components/schemas/ProblemDetails"}}},
 }

 return operation

def generate_spec(
 name: str,
 version: str,
 endpoints: list[str],
 base_url: str,
) -> dict:
 """Generate a complete OpenAPI 3.1 specification."""
 spec: dict = {
 "openapi": "3.1.0",
 "info": {
 "title": name,
 "version": version,
 "description": f"API specification for {name}",
 "contact": {"name": "API Support"},
 "license": {"name": "MIT", "url": "https://opensource.org/licenses/MIT"},
 },
 "servers": [
 {"url": base_url, "description": "Development server"},
 {"url": base_url.replace("localhost", "api.example.com"), "description": "Production server"},
 ],
 "paths": {},
 "components": {
 "schemas": {"ProblemDetails": build_error_schema()},
 "securitySchemes": {
 "bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"},
 },
 },
 "security": [{"bearerAuth": []}],
 "tags": [],
 }

 resources_seen: set[str] = set()

 for endpoint_str in endpoints:
 method, path = parse_endpoint(endpoint_str)
 resource = infer_resource(path)

 if path not in spec["paths"]:
 spec["paths"][path] = {}

 spec["paths"][path][method] = build_path_item(method, path, resource)

 if resource not in resources_seen:
 resources_seen.add(resource)
 spec["tags"].append({"name": resource + "s", "description": f"Operations on {resource.lower()}s"})
 spec["components"]["schemas"][resource] = build_schema(resource)
 spec["components"]["schemas"][f"{resource}Create"] = build_schema(
 f"{resource}Create",
 {"name": "string", "email": "string"},
 )
 spec["components"]["schemas"][f"{resource}Update"] = build_schema(
 f"{resource}Update",
 {"name": "string", "email": "string"},
 )

 return spec

def to_yaml(data: dict, indent: int = 0) -> str:
 """Simple dict-to-YAML converter (avoids PyYAML dependency)."""
 # Use JSON since yaml may not be installed
 return json.dumps(data, indent=2)

def main() -> None:
 parser = argparse.ArgumentParser(description="Scaffold an OpenAPI 3.1 specification")
 parser.add_argument("--name", default="My API", help="API name")
 parser.add_argument("--version", default="1.0.0", help="API version")
 parser.add_argument("--url", default="http://localhost:8080", help="Base URL")
 parser.add_argument("--output", default="openapi.json", help="Output file (json)")
 parser.add_argument(
 "--endpoints",
 default="GET /api/v1/users, POST /api/v1/users, GET /api/v1/users/{id}, PUT /api/v1/users/{id}, DELETE /api/v1/users/{id}",
 help="Comma-separated list of 'METHOD /path' definitions",
 )

 args = parser.parse_args()
 endpoints = [e.strip() for e in args.endpoints.split(",")]

 print(f"Scaffolding OpenAPI spec for '{args.name}'...")
 print(f" Endpoints: {len(endpoints)}")

 spec = generate_spec(args.name, args.version, endpoints, args.url)

 output_path = Path(args.output)
 output_path.write_text(json.dumps(spec, indent=2), encoding="utf-8")
 print(f" Created: {output_path}")

 print(f"\n Resources: {', '.join(t['name'] for t in spec['tags'])}")
 print(f" Schemas: {len(spec['components']['schemas'])}")
 print(f"\n View: Open {output_path} in Swagger Editor or Redoc")

if __name__ == "__main__":
 main()
