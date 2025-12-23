import sqlite3

db_path = r"C:\Users\drmoy\OneDrive - studygram.me\VsCode\db-synchronizer\backend\data\config_v2.db"
print(f"Connecting to: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [t[0] for t in cursor.fetchall()]
print(f"Tables: {tables}")

if 'datasource_views' in tables:
    cursor.execute("PRAGMA table_info(datasource_views)")
    columns = [col[1] for col in cursor.fetchall()]
    print(f"Columns: {columns}")

    if 'webhooks' not in columns:
        print("Adding 'webhooks' column...")
        cursor.execute("ALTER TABLE datasource_views ADD COLUMN webhooks TEXT DEFAULT '[]'")
        conn.commit()
        print("SUCCESS! Column added.")
    else:
        print("Column 'webhooks' already exists.")
else:
    print("Table datasource_views not found!")

conn.close()
