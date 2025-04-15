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
        
        # Get all descriptions with their corresponding paths and dates
        cursor.execute("""
            SELECT description, path, date 
            FROM imagenes 
            WHERE description IS NOT NULL 
            ORDER BY date DESC
        """)
        photos = cursor.fetchall()
        
        # Count tags and track latest photos
        tags_data = {}
        for description, path, date in photos:
            if description:
                matches = re.finditer(r'#(\w+)', description.lower())
                for match in matches:
                    tag = match.group(0)  # includes the # symbol
                    if tag not in tags_data:
                        tags_data[tag] = {
                            "count": 0,
                            "latest_photos": []
                        }
                    tags_data[tag]["count"] += 1
                    
                    # Keep only the 4 most recent photos for each tag
                    if len(tags_data[tag]["latest_photos"]) < 4:
                        tags_data[tag]["latest_photos"].append(path)
        
        # Sort tags by frequency
        sorted_tags = [
            {
                "tag": tag,
                "count": data["count"],
                "latest_photos": data["latest_photos"]
            }
            for tag, data in sorted(tags_data.items(), key=lambda x: (-x[1]["count"], x[0]))
        ]
        
        # Create cache data
        cache_data = {
            "lastUpdate": datetime.now().isoformat(),
            "tags": sorted_tags
        }
        
        # Write to JSON file
        with open('../tags-cache.json', 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
        print("Tags cache updated successfully")
        conn.close()
        
    except Exception as e:
        print(f"Error updating tags cache: {e}")

if __name__ == "__main__":
    update_tags_cache()