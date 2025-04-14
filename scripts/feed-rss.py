#!/usr/bin/env python3
import sqlite3
import os
from datetime import datetime
import xml.etree.ElementTree as ET
from xml.dom import minidom

def generate_rss():
    try:
        # Get the project root directory (parent of scripts directory)
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        db_path = os.path.join(project_root, 'fotos.db')
        
        # Create RSS feed structure
        rss = ET.Element('rss', version='2.0')
        channel = ET.SubElement(rss, 'channel')
        
        # Add channel information
        title = ET.SubElement(channel, 'title')
        title.text = 'Fotos de Valladolid - Aldea Pucela'
        
        link = ET.SubElement(channel, 'link')
        link.text = 'https://fotos.aldeapucela.org/'
        
        desc = ET.SubElement(channel, 'description')
        desc.text = 'Fotos de Valladolid de la mayor comunidad vecinal online sobre Valladolid'
        
        # Add license information
        rights = ET.SubElement(channel, 'copyright')
        rights.text = 'Las imágenes están bajo licencia CC BY-SA 4.0 - https://creativecommons.org/licenses/by-sa/4.0/'
        
        license = ET.SubElement(channel, 'creativeCommons:license', {'xmlns:creativeCommons': 'http://backend.userland.com/creativeCommonsRssModule'})
        license.text = 'https://creativecommons.org/licenses/by-sa/4.0/'
        
        language = ET.SubElement(channel, 'language')
        language.text = 'es'
        
        # Add item generation time
        lastBuildDate = ET.SubElement(channel, 'lastBuildDate')
        lastBuildDate.text = datetime.now().strftime('%a, %d %b %Y %H:%M:%S +0000')
        
        # Connect to database and get latest 100 photos
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT path, date, author, description 
            FROM imagenes 
            WHERE description IS NOT NULL 
            ORDER BY date DESC LIMIT 100
        """)
        photos = cursor.fetchall()
        
        # Add items to feed
        for photo in photos:
            path, date, author, description = photo
            
            item = ET.SubElement(channel, 'item')
            
            # Item title - use first line of description or filename
            item_title = ET.SubElement(item, 'title')
            if description:
                # Use first line or first 60 chars of description
                title_text = description.split('\n')[0][:60]
                if len(title_text) == 60:
                    title_text += '...'
            else:
                title_text = os.path.basename(path)
            item_title.text = title_text
            
            # Item link - direct link to photo
            item_link = ET.SubElement(item, 'link')
            item_link.text = f'https://fotos.aldeapucela.org/#{path.replace(".jpg", "")}'
            
            # Item description
            item_desc = ET.SubElement(item, 'description')
            html_desc = f'<img src="https://fotos.aldeapucela.org/files/{path}" style="max-width:600px;height:auto;"/>'
            if description:
                html_desc += f'<p>{description}</p>'
            if author:
                image_id = path.replace('.jpg', '')
                html_desc += f'<p>Autor: {author} - CC BY-SA 4.0</p>'
                html_desc += f'<p><a href="https://t.me/AldeaPucela/27202/{image_id}">Ver original</a></p>'
            item_desc.text = html_desc
            
            # Publication date
            pub_date = ET.SubElement(item, 'pubDate')
            try:
                dt = datetime.strptime(date, '%Y-%m-%d %H:%M:%S')
                pub_date.text = dt.strftime('%a, %d %b %Y %H:%M:%S +0000')
            except:
                pub_date.text = datetime.now().strftime('%a, %d %b %Y %H:%M:%S +0000')
            
            # Unique ID
            guid = ET.SubElement(item, 'guid')
            guid.text = f'https://fotos.aldeapucela.org/files/{path}'
            
        # Generate pretty-printed XML
        xmlstr = minidom.parseString(ET.tostring(rss)).toprettyxml(indent="  ")
        
        # Write to file
        output_path = os.path.join(project_root, 'feed.xml')
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(xmlstr)
            
        print(f"RSS feed generado correctamente en {output_path}")
        conn.close()
        
    except Exception as e:
        print(f"Error generando el feed RSS: {e}")

if __name__ == "__main__":
    generate_rss()