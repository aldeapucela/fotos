#!/usr/bin/env python3
import fcntl
import hashlib
import sqlite3
import os
import json
from datetime import datetime
from pathlib import Path
import xml.etree.ElementTree as ET
from xml.dom import minidom
from generate_photo_pages import generate_photo_pages, write_text_if_changed

def iso8601_to_rfc822(iso_date):
    """Convert ISO 8601 date to RFC 822 format required by RSS"""
    try:
        # Parse ISO 8601 date (2025-04-13T14:45:42.025+02:00)
        date_part, tz = iso_date.split('+')
        dt = datetime.fromisoformat(date_part)
        # Convert to RFC 822 format
        return dt.strftime('%a, %d %b %Y %H:%M:%S +') + tz.replace(':', '')
    except (AttributeError, TypeError, ValueError):
        return 'Thu, 01 Jan 1970 00:00:00 +0000'

def generate_rss(project_root=None):
    try:
        # Get the project root directory (parent of scripts directory)
        project_root = Path(project_root) if project_root else Path(__file__).resolve().parent.parent
        db_path = project_root / 'fotos.db'
        
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
        
        # Se completa con la fecha de la foto más reciente para que la salida
        # sea determinista cuando la base de datos no ha cambiado.
        lastBuildDate = ET.SubElement(channel, 'lastBuildDate')
        
        # Connect to database and get all photos. RSS is limited below, while
        # the JSON feed exposes the complete result set.
        with sqlite3.connect(db_path) as conn:
            photos = conn.execute("""
                SELECT i.path, i.date, i.author, i.description
                FROM imagenes i
                LEFT JOIN image_analysis ia ON ia.image_id = i.id
                WHERE i.description IS NOT NULL
                AND (ia.is_appropriate = 1 OR ia.is_appropriate IS NULL)
                ORDER BY i.date DESC
            """).fetchall()

        output_path = project_root / 'feed.xml'
        json_output_path = project_root / 'data.json'
        state_path = project_root / '.feed-rss-state.json'
        signature_payload = json.dumps(
            {
                'script': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                'photos': photos,
            },
            ensure_ascii=False,
            separators=(',', ':'),
        )
        feed_signature = hashlib.sha256(signature_payload.encode('utf-8')).hexdigest()
        try:
            previous_signature = json.loads(
                state_path.read_text(encoding='utf-8')
            ).get('signature')
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            previous_signature = None

        if (
            previous_signature == feed_signature
            and output_path.is_file()
            and json_output_path.is_file()
        ):
            print(f"RSS: sin cambios ({output_path})")
            print(f"JSON: sin cambios ({json_output_path})")
            generate_photo_pages(project_root)
            return

        lastBuildDate.text = datetime.now().strftime('%a, %d %b %Y %H:%M:%S +0200')

        channel_data = {
            'title': title.text,
            'link': link.text,
            'description': desc.text,
            'copyright': rights.text,
            'creativeCommons:license': {
                '_': license.text,
                'xmlns:creativeCommons': 'http://backend.userland.com/creativeCommonsRssModule'
            },
            'language': language.text,
            'lastBuildDate': lastBuildDate.text,
            'item': []
        }

        # Build all items for the JSON API and only the latest 100 for RSS.
        for index, photo in enumerate(photos):
            path, date, author, description = photo

            # Item title - use first line of description or filename
            if description:
                # Use first line or first 60 chars of description
                title_text = description.split('\n')[0][:60]
                if len(title_text) == 60:
                    title_text += '...'
            else:
                title_text = os.path.basename(path)

            image_id = os.path.splitext(os.path.basename(path))[0]
            item_link = f'https://fotos.aldeapucela.org/f/{image_id}/'

            # Item description
            html_desc = f'<img src="https://fotos.aldeapucela.org/files/{path}" style="max-width:600px;height:auto;"/>'
            if description:
                html_desc += f'<p>{description}</p>'
            if author:
                html_desc += f'<p>Autor/a: {author} - CC BY-SA 4.0</p>'
                html_desc += f'<p><a href="https://t.me/AldeaPucela/27202/{image_id}">Ver original</a></p>'

            # Publication date - Convert ISO 8601 to RFC 822
            pub_date = iso8601_to_rfc822(date)
            guid = f'https://fotos.aldeapucela.org/files/{path}'

            item_data = {
                'title': title_text,
                'link': item_link,
                'description': html_desc,
                'pubDate': pub_date,
                'guid': guid
            }
            channel_data['item'].append(item_data)

            if index < 100:
                item = ET.SubElement(channel, 'item')
                for field, value in item_data.items():
                    element = ET.SubElement(item, field)
                    element.text = value

        # Generate pretty-printed XML
        xmlstr = minidom.parseString(ET.tostring(rss)).toprettyxml(indent="  ")
        
        # Write to file
        rss_changed = write_text_if_changed(output_path, xmlstr)

        json_content = json.dumps([{'rss': {
                'version': '2.0',
                'channel': channel_data
            }}], ensure_ascii=False, indent=2) + '\n'
        json_changed = write_text_if_changed(json_output_path, json_content)

        print(f"RSS: {'actualizado' if rss_changed else 'sin cambios'} ({output_path})")
        print(f"JSON: {'actualizado' if json_changed else 'sin cambios'} ({json_output_path})")
        state_content = json.dumps(
            {'version': 1, 'signature': feed_signature},
            indent=2,
            sort_keys=True,
        ) + '\n'
        write_text_if_changed(state_path, state_content, mode=0o600)
        generate_photo_pages(project_root)
        
    except Exception as e:
        print(f"Error generando el feed RSS: {e}")
        raise


def main():
    project_root = Path(__file__).resolve().parent.parent
    lock_path = project_root / '.feed-rss.lock'
    with lock_path.open('a+', encoding='utf-8') as lock_file:
        try:
            fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Otra generación sigue activa; se omite esta ejecución.')
            return
        generate_rss(project_root)


if __name__ == "__main__":
    main()
