#!/usr/bin/env python3
import sqlite3
import json
from datetime import datetime
import os

def update_ai_tags_cache():
    try:
        # Get the project root directory (parent of scripts directory)
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        conn = sqlite3.connect(os.path.join(project_root, 'fotos.db'))
        cursor = conn.cursor()
        
        # Get all AI tags from the database
        cursor.execute("""
            SELECT i.path, ia.tags 
            FROM image_analysis ia
            JOIN imagenes i ON i.id = ia.image_id
            WHERE ia.tags IS NOT NULL 
            AND ia.is_appropriate = 1
            ORDER BY i.date DESC
        """)
        photos = cursor.fetchall()
        
        # Count tags and track latest photos
        tags_data = {}
        for path, tags_json in photos:
            if tags_json:
                try:
                    tags = json.loads(tags_json)
                    for tag in tags:
                        if tag not in tags_data:
                            tags_data[tag] = {
                                "count": 0,
                                "latest_photos": []
                            }
                        tags_data[tag]["count"] += 1
                        
                        # Keep only the 4 most recent photos for each tag
                        if len(tags_data[tag]["latest_photos"]) < 4:
                            tags_data[tag]["latest_photos"].append(path)
                except json.JSONDecodeError:
                    continue
        
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
        with open(os.path.join(project_root, 'ai-tags-cache.json'), 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
        print("AI tags cache updated successfully")
        conn.close()
        
    except Exception as e:
        print(f"Error updating AI tags cache: {e}")

if __name__ == "__main__":
    update_ai_tags_cache()