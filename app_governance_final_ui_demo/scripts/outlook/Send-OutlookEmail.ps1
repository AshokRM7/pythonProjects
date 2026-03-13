<#
.SYNOPSIS
    Send an email from Microsoft Outlook using COM Automation.

.DESCRIPTION
    Uses the locally installed Outlook COM object to compose and send an
    email through the authenticated Outlook account – no SMTP credentials
    required.  Python calls this script via subprocess and reads the JSON
    result from stdout.

.PARAMETER To
    Recipient email address(es). For multiple recipients separate with a
    comma: "a@x.com,b@y.com"

.PARAMETER Subject
    Email subject line.

.PARAMETER Body
    Plain-text or HTML email body.

.PARAMETER IsHtml
    Switch. Pass this flag if -Body contains HTML markup.

.PARAMETER Cc
    Optional CC addresses (comma-separated).

.PARAMETER AttachmentPaths
    Optional array of absolute file paths to attach.

.EXAMPLE
    .\Send-OutlookEmail.ps1 `
        -To "owner@company.com" `
        -Subject "IAM Evidence Required" `
        -Body "Please submit evidence for ticket IAM-0042."

.EXAMPLE
    .\Send-OutlookEmail.ps1 `
        -To "owner@company.com,reviewer@company.com" `
        -Subject "BRE Remediation Complete" `
        -Body "<h2>Done</h2>" -IsHtml `
        -AttachmentPaths "C:\reports\evidence.pdf"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$To,

    [Parameter(Mandatory = $true)]
    [string]$Subject,

    [Parameter(Mandatory = $true)]
    [string]$Body,

    [switch]$IsHtml,

    [string]$Cc = "",

    [string[]]$AttachmentPaths = @()
)

# ─── Result object – always output as JSON so Python can parse stdout ─────────
$result = @{
    sent       = $false
    mode       = "outlook_com"
    recipients = @()
    timestamp  = (Get-Date -Format "o")   # ISO-8601
    error      = $null
}

# ─── Validate & split recipient list ─────────────────────────────────────────
$emailRegex = '^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
$toList = $To -split '[,;]' |
          ForEach-Object { $_.Trim() } |
          Where-Object   { $_ -match $emailRegex }

if ($toList.Count -eq 0) {
    $result.error = "No valid recipient email addresses found in: $To"
    $result | ConvertTo-Json -Depth 3
    exit 1
}
$result.recipients = $toList

# ─── Verify attachments exist before opening Outlook ─────────────────────────
foreach ($path in $AttachmentPaths) {
    if (-not (Test-Path $path)) {
        $result.error = "Attachment file not found: $path"
        $result | ConvertTo-Json -Depth 3
        exit 1
    }
}

# ─── Main send logic via Outlook COM ─────────────────────────────────────────
$outlook = $null
$mail    = $null

try {
    # Get or create the Outlook COM instance.
    # If Outlook is already open, this reuses the running instance.
    $outlook = New-Object -ComObject Outlook.Application

    # 0 = olMailItem (a standard email message)
    $mail = $outlook.CreateItem(0)

    # Set recipients (semicolon-separated for Outlook)
    $mail.To = ($toList -join "; ")

    # Optional CC
    if ($Cc) {
        $ccList = $Cc -split '[,;]' |
                  ForEach-Object { $_.Trim() } |
                  Where-Object   { $_ -match $emailRegex }
        if ($ccList.Count -gt 0) {
            $mail.CC = ($ccList -join "; ")
        }
    }

    $mail.Subject = $Subject

    # Choose HTMLBody vs plain Body
    if ($IsHtml) {
        $mail.HTMLBody = $Body
    } else {
        $mail.Body = $Body
    }

    # Add attachments (if any)
    foreach ($path in $AttachmentPaths) {
        # 1 = olByValue (attach a copy of the file)
        $mail.Attachments.Add($path, 1) | Out-Null
    }

    # Send the message through the configured Outlook account
    $mail.Send()

    $result.sent = $true

} catch {
    # Capture the COM/PS exception message and surface it as JSON
    $result.error = $_.Exception.Message
    $result | ConvertTo-Json -Depth 3
    exit 1

} finally {
    # Release COM objects to avoid Outlook process locks
    if ($null -ne $mail)    { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($mail)    | Out-Null }
    if ($null -ne $outlook) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($outlook) | Out-Null }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}

# ─── Output JSON result for Python to capture from stdout ────────────────────
$result | ConvertTo-Json -Depth 3
exit 0
