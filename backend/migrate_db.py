
import asyncio
import sqlite3
import os

async def migrate():
    db_path = "./data/config_v2.db"
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    print(f"Migrating {db_path}...")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='datasource_views'")
        if not cursor.fetchone():
            print("Table 'datasource_views' does not exist yet. create_all will handle it.")
            return

        # Check if column exists
        cursor.execute("PRAGMA table_info(datasource_views)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'visible_columns' not in columns:
            print("Adding 'visible_columns' to 'datasource_views'...")
            cursor.execute("ALTER TABLE datasource_views ADD COLUMN visible_columns JSON DEFAULT '[]'")
            print("Successfully added column.")
        else:
            print("Column 'visible_columns' already exists.")
            
        conn.commit()
    except Exception as e:
        print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    asyncio.run(migrate())
