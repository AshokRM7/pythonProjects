import pandas as pd
import os

def create_mock_xlsx():
    path = "backend/data/pcat/metadata_validation_template_mock.xlsx"
    df = pd.DataFrame(columns=[
        "row_id", "application_name", "permission_name", "permission_description",
        "platform_category", "platform_type", "capability", "function",
        "data_classification", "account_type", "managed_by", "provided_by", "additional_info"
    ])
    df.to_excel(path, index=False)
    print(f"Created {path}")

if __name__ == "__main__":
    create_mock_xlsx()
