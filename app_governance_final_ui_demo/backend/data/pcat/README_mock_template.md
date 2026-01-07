# PCAT Metadata Validation Template

This template is used for classifying and attesting application permissions.

## Structure
The template contains the following columns:
- **row_id**: Unique identifier for the row.
- **application_name**: Name of the application.
- **permission_name**: Name of the permission/entitlement.
- **permission_description**: Detailed description of the permission.
- **platform_category**: E.g., WAN, APPLICATION, DATABASE.
- **platform_type**: E.g., CLOUD, ON-PREM.
- **capability**: E.g., Read Only, Modify, Admin.
- **function**: E.g., Business, IT.
- **data_classification**: E.g., Public, Confidential.
- **account_type**: E.g., Human, Service Account.
- **managed_by**: E.g., AD, Local.
- **provided_by**: Source systems.

## Macro Usage (Simulated)
In the full version, this Excel file contains macros to:
1. Validate data against allowed lists.
2. Highlight conflicts in real-time.
3. Generate a submission package.

*Note: For this demo, validations are performed by the PCAT Backend Engine.*
