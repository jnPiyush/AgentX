#!/usr/bin/env python3
"""Scaffold database migration files for common ORMs.

Generates migration scaffolds with up/down SQL and proper naming.

Usage:
 python scaffold-migration.py --name add_users_table --orm raw
 python scaffold-migration.py --name add_orders --orm efcore
 python scaffold-migration.py --name add_products --orm alembic
"""

import argparse
import os
from datetime import datetime
from pathlib import Path

RAW_UP_TEMPLATE = """\
-- Migration: {name}
-- Created: {timestamp}
-- Description: {description}

BEGIN;

-- Add your schema changes here
-- Example:
-- CREATE TABLE {table_name} (
-- id SERIAL PRIMARY KEY,
-- name VARCHAR(255) NOT NULL,
-- created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
-- updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
--
-- CREATE INDEX idx_{table_name}_name ON {table_name}(name);

COMMIT;
"""

RAW_DOWN_TEMPLATE = """\
-- Rollback: {name}
-- Reverses the migration above

BEGIN;

-- Undo the schema changes
-- Example:
-- DROP TABLE IF EXISTS {table_name};

COMMIT;
"""

EFCORE_TEMPLATE = """\
using Microsoft.EntityFrameworkCore.Migrations;

#nullable enable

namespace Migrations;

/// <inheritdoc />
public partial class {class_name} : Migration
{{
 /// <inheritdoc />
 protected override void Up(MigrationBuilder migrationBuilder)
 {{
 // Add schema changes here
 // migrationBuilder.CreateTable(
 // name: "{table_name}",
 // columns: table => new
 // {{
 // Id = table.Column<int>(nullable: false)
 // .Annotation("Npgsql:ValueGenerationStrategy",
 // NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
 // Name = table.Column<string>(maxLength: 255, nullable: false),
 // CreatedAt = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
 // }},
 // constraints: table =>
 // {{
 // table.PrimaryKey("PK_{table_name}", x => x.Id);
 // }});
 }}

 /// <inheritdoc />
 protected override void Down(MigrationBuilder migrationBuilder)
 {{
 // migrationBuilder.DropTable(name: "{table_name}");
 }}
}}
"""

ALEMBIC_TEMPLATE = """\
\"""
{description}

Revision ID: {revision_id}
Revises: 
Create Date: {timestamp}
\"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '{revision_id}'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
 # Add schema changes here
 # op.create_table(
 # '{table_name}',
 # sa.Column('id', sa.Integer(), nullable=False),
 # sa.Column('name', sa.String(255), nullable=False),
 # sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
 # sa.PrimaryKeyConstraint('id'),
 # )
 # op.create_index('idx_{table_name}_name', '{table_name}', ['name'])
 pass

def downgrade() -> None:
 # op.drop_table('{table_name}')
 pass
"""

def generate_revision_id() -> str:
 """Generate a short revision ID."""
 import hashlib
 return hashlib.sha256(datetime.now().isoformat().encode()).hexdigest()[:12]

def to_class_name(name: str) -> str:
 """Convert snake_case to PascalCase."""
 return "".join(word.capitalize() for word in name.split("_"))

def infer_table(name: str) -> str:
 """Infer table name from migration name."""
 # Remove common prefixes
 for prefix in ["add_", "create_", "alter_", "modify_", "drop_", "remove_"]:
 if name.startswith(prefix):
 return name[len(prefix):].rstrip("_table")
 return name

def main() -> None:
 parser = argparse.ArgumentParser(description="Scaffold database migration")
 parser.add_argument("--name", required=True, help="Migration name (snake_case)")
 parser.add_argument("--orm", choices=["raw", "efcore", "alembic"], default="raw",
 help="ORM/framework type")
 parser.add_argument("--output", default="./migrations", help="Output directory")
 parser.add_argument("--description", default="", help="Migration description")

 args = parser.parse_args()
 output_dir = Path(args.output)
 output_dir.mkdir(parents=True, exist_ok=True)

 timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
 table_name = infer_table(args.name)
 description = args.description or f"Migration: {args.name}"

 print(f"Scaffolding migration: {args.name}")
 print(f" ORM: {args.orm}")
 print(f" Table: {table_name}")

 files: list[str] = []

 if args.orm == "raw":
 # Raw SQL up/down files
 up_file = output_dir / f"{timestamp}_{args.name}.up.sql"
 down_file = output_dir / f"{timestamp}_{args.name}.down.sql"
 
 up_file.write_text(RAW_UP_TEMPLATE.format(
 name=args.name, timestamp=timestamp,
 description=description, table_name=table_name,
 ))
 down_file.write_text(RAW_DOWN_TEMPLATE.format(
 name=args.name, table_name=table_name,
 ))
 files.extend([str(up_file), str(down_file)])

 elif args.orm == "efcore":
 migration_file = output_dir / f"{timestamp}_{to_class_name(args.name)}.cs"
 migration_file.write_text(EFCORE_TEMPLATE.format(
 class_name=to_class_name(args.name),
 table_name=table_name,
 ))
 files.append(str(migration_file))

 elif args.orm == "alembic":
 revision_id = generate_revision_id()
 migration_file = output_dir / f"{revision_id}_{args.name}.py"
 migration_file.write_text(ALEMBIC_TEMPLATE.format(
 description=description,
 revision_id=revision_id,
 timestamp=datetime.now().isoformat(),
 table_name=table_name,
 ))
 files.append(str(migration_file))

 print(f"\nCreated {len(files)} file(s):")
 for f in files:
 print(f" - {os.path.relpath(f)}")

if __name__ == "__main__":
 main()
