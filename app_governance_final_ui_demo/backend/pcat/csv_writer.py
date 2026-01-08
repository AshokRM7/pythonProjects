import csv
import os
from typing import List
from .models import PCATRow

class PCATCSVWriter:
    @staticmethod
    def write_csv(file_path: str, rows: List[PCATRow]):
        """
        Writes a list of PCATRow objects to a CSV file.
        """
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        headers = [
            "row_id", "application_name", "permission_name", "permission_description",
            "platform_category", "platform_type", "capability", "function",
            "data_classification", "account_type", "managed_by", "provided_by",
            "additional_info"
        ]
        
        with open(file_path, mode='w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            for row in rows:
                # Convert Pydantic model to dict, then ensure only header fields are used
                row_data = row.model_dump()
                filtered_data = {k: row_data[k] for k in headers}
                writer.writerow(filtered_data)
        
        return file_path
