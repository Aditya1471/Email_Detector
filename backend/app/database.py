import os
import json
import uuid
from datetime import datetime
from bson.objectid import ObjectId
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

class MockCollection:
    """Mock MongoDB Collection wrapper using a local JSON file database."""
    def __init__(self, db_file, name):
        self.db_file = db_file
        self.name = name

    def _read_data(self):
        if not os.path.exists(self.db_file):
            return {}
        try:
            with open(self.db_file, 'r') as f:
                return json.load(f)
        except Exception:
            return {}

    def _write_data(self, data):
        try:
            with open(self.db_file, 'w') as f:
                json.dump(data, f, default=str, indent=2)
        except Exception as e:
            print(f"[Error] Failed to write fallback JSON DB: {e}")

    def find(self, filter_query=None):
        filter_query = filter_query or {}
        all_data = self._read_data()
        items = all_data.get(self.name, [])
        
        # Apply simple filters
        results = []
        for item in items:
            matches = True
            for k, v in filter_query.items():
                # Handle ID checking
                if k == '_id':
                    if str(item.get('_id')) != str(v):
                        matches = False
                        break
                elif item.get(k) != v:
                    matches = False
                    break
            if matches:
                results.append(item)
        return results

    def find_one(self, filter_query=None):
        results = self.find(filter_query)
        return results[0] if results else None

    def insert_one(self, document):
        all_data = self._read_data()
        if self.name not in all_data:
            all_data[self.name] = []
            
        if '_id' not in document:
            document['_id'] = str(uuid.uuid4())
            
        # Convert datetime objects to string representation
        serialized_doc = {}
        for k, v in document.items():
            if isinstance(v, datetime):
                serialized_doc[k] = v.isoformat()
            else:
                serialized_doc[k] = v
                
        all_data[self.name].append(serialized_doc)
        self._write_data(all_data)
        
        class InsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id
        return InsertResult(document['_id'])

    def update_one(self, filter_query, update_query):
        all_data = self._read_data()
        items = all_data.get(self.name, [])
        
        # Parse set operations
        set_ops = update_query.get('$set', {})
        updated_count = 0
        
        for item in items:
            matches = True
            for k, v in filter_query.items():
                if k == '_id':
                    if str(item.get('_id')) != str(v):
                        matches = False
                        break
                elif item.get(k) != v:
                    matches = False
                    break
                    
            if matches:
                for sk, sv in set_ops.items():
                    if isinstance(sv, datetime):
                        item[sk] = sv.isoformat()
                    else:
                        item[sk] = sv
                updated_count += 1
                break
                
        if updated_count > 0:
            all_data[self.name] = items
            self._write_data(all_data)
            
        class UpdateResult:
            def __init__(self, modified_count):
                self.modified_count = modified_count
        return UpdateResult(updated_count)

    def delete_one(self, filter_query):
        all_data = self._read_data()
        items = all_data.get(self.name, [])
        new_items = []
        deleted = 0
        
        for item in items:
            matches = True
            for k, v in filter_query.items():
                if k == '_id':
                    if str(item.get('_id')) != str(v):
                        matches = False
                        break
                elif item.get(k) != v:
                    matches = False
                    break
            if matches and deleted == 0:
                deleted += 1
            else:
                new_items.append(item)
                
        if deleted > 0:
            all_data[self.name] = new_items
            self._write_data(all_data)
            
        class DeleteResult:
            def __init__(self, deleted_count):
                self.deleted_count = deleted_count
        return DeleteResult(deleted)

    def count_documents(self, filter_query=None):
        return len(self.find(filter_query))

class MockDatabase:
    """Mock PyMongo database matching standard connection parameters."""
    def __init__(self, db_file):
        self.db_file = db_file
        
    def __getattr__(self, name):
        return MockCollection(self.db_file, name)
        
    def __getitem__(self, name):
        return MockCollection(self.db_file, name)

class DynamicDatabase:
    """Dynamic connection database switcher linking MongoDB / Local JSON repositories."""
    def __init__(self):
        self._db = None
        self.is_fallback = False
        
    def initialize(self, mongo_uri):
        try:
            # Attempt to connect to real MongoDB instance
            client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
            client.server_info()  # Forces connection test
            self._db = client.get_default_database()
            self.is_fallback = False
            print("[Database] Successfully connected to real MongoDB instance.")
        except (ConnectionFailure, Exception) as err:
            # Fallback to local JSON database
            db_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'phishing_db.json')
            self._db = MockDatabase(db_file)
            self.is_fallback = True
            print(f"[Database] Fallback mode active: Utilizing local JSON file database. ({err})")
            
    def __getattr__(self, name):
        return getattr(self._db, name)
        
    def __getitem__(self, name):
        return self._db[name]

db = DynamicDatabase()
