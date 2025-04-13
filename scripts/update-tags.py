#!/usr/bin/env python3
import sqlite3
import json
from datetime import datetime
import re

def update_tags_cache():
    try:
        # Connect to SQLite database
        conn = sqlite3.connect('../fotos.db')
        cursor = conn.cursor()
        
        # Get all descriptions
        cursor.execute("SELECT description FROM imagenes WHERE description IS NOT NULL")
        descriptions = cursor.fetchall()
        
        # Count tags
        tags_count = {}
        for (description,) in descriptions:
            if description:
                matches = re.finditer(r'#(\w+)', description.lower())
                for match in matches:
                    tag = match.group(0)  # includes the # symbol
                    tags_count[tag] = tags_count.get(tag, 0) + 1
        
        # Sort tags by frequency
        sorted_tags = [
            {"tag": tag, "count": count}
            for tag, count in sorted(tags_count.items(), key=lambda x: (-x[1], x[0]))
        ]
        
        # Create cache data
        cache_data = {
            "lastUpdate": datetime.now().isoformat(),
            "tags": sorted_tags
        }
        
        # Write to JSON file
        with open('tags-cache.json', 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
        print("Tags cache updated successfully")
        conn.close()
        
    except Exception as e:
        print(f"Error updating tags cache: {e}")

if __name__ == "__main__":
    update_tags_cache()