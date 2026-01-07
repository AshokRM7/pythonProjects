import csv
import os
from typing import List
from .models import PCATRow

class PCATLoader:
    @staticmethod
    def load_csv(file_path: str) -> List[PCATRow]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PCAT CSV not found: {file_path}")
        
        rows = []
        with open(file_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Basic normalization
                try:
                    rows.append(PCATRow(
                        row_id=int(row['row_id']),
                        application_name=row.get('application_name', ''),
                        permission_name=row.get('permission_name', ''),
                        permission_description=row.get('permission_description', ''),
                        platform_category=row.get('platform_category', ''),
                        platform_type=row.get('platform_type', ''),
                        capability=row.get('capability', ''),
                        function=row.get('function', ''),
                        data_classification=row.get('data_classification', ''),
                        account_type=row.get('account_type', ''),
                        managed_by=row.get('managed_by', ''),
                        provided_by=row.get('provided_by', ''),
                        additional_info=row.get('additional_info', '')
                    ))
                except Exception as e:
                    print(f"Error parsing row {row.get('row_id')}: {e}")
        return rows
