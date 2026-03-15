<#
.SYNOPSIS
    Read emails from the Microsoft Outlook Inbox using COM Automation.

.DESCRIPTION
    Connects to the locally installed Outlook application via COM, opens the
    Inbox, and returns a JSON array of email objects to stdout.
    Python can call this script with subprocess and json.loads() the output.

    Each email object contains:
        - Id            : Outlook EntryID (unique identifier for this item)
        - Subject       : Email subject
        - SenderName    : Display name of the sender
        - SenderEmail   : Email address of the sender
        - ReceivedTime  : ISO-8601 timestamp when the email arrived
        - Body          : Plain-text body (first 2000 chars to avoid huge payloads)
        - HasAttachments: true/false
        - Attachments   : Array of {FileName, FileSize} objects (empty if none)
        - AttachmentPaths: Array of absolute paths where attachments were saved
                           (only populated when -SaveAttachments is used)

.PARAMETER MaxEmails
    Maximum number of emails to read (newest first). Default: 20.

.PARAMETER UnreadOnly
    Switch. If set, only unread emails are returned.

.PARAMETER SaveAttachments
    Switch. If set, attachments are saved to the -AttachmentSaveDir folder.

.PARAMETER AttachmentSaveDir
    Folder where attachments are saved when -SaveAttachments is used.
    Defaults to the script's directory under .\downloaded_attachments\

.PARAMETER SubjectFilter
    Optional substring to filter emails by subject (case-insensitive).

.EXAMPLE
    # Read the 10 most recent emails
    .\Read-OutlookEmails.ps1 -MaxEmails 10

.EXAMPLE
    # Read unread emails and save their attachments
    .\Read-OutlookEmails.ps1 -UnreadOnly -SaveAttachments `
        -AttachmentSaveDir "C:\AppGovernance\attachments"

.EXAMPLE
    # Filter by subject keyword
    .\Read-OutlookEmails.ps1 -SubjectFilter "IAM Deliverable" -MaxEmails 5
#>

[CmdletBinding()]
param(
    [int]$MaxEmails = 20,

    [switch]$UnreadOnly,

    [switch]$SaveAttachments,

    [string]$AttachmentSaveDir = "",

    [string]$SubjectFilter = ""
)

# ─── Result envelope ──────────────────────────────────────────────────────────
$envelope = @{
    success    = $false
    count      = 0
    emails     = @()
    error      = $null
    timestamp  = (Get-Date -Format "o")
}

# ─── Attachment output directory ──────────────────────────────────────────────
if (-not $AttachmentSaveDir) {
    $AttachmentSaveDir = Join-Path $PSScriptRoot "downloaded_attachments"
}

if ($SaveAttachments -and -not (Test-Path $AttachmentSaveDir)) {
    New-Item -ItemType Directory -Path $AttachmentSaveDir -Force | Out-Null
}

# ─── Connect to Outlook ───────────────────────────────────────────────────────
$outlook = $null
$inbox   = $null

try {
    # Reuse the running Outlook instance (or start one if needed)
    $outlook = New-Object -ComObject Outlook.Application

    # GetNamespace("MAPI") gives access to all Outlook folders
    $namespace = $outlook.GetNamespace("MAPI")

    # 6 = olFolderInbox – the default Inbox folder of the primary account
    $inbox = $namespace.GetDefaultFolder(6)

    # ── Pre-filter items to avoid COM timeouts on large inboxes ───────────────
    $items = $inbox.Items

    if ($UnreadOnly) {
        try { $items = $items.Restrict("[Unread] = true") } catch { }
    }

    if ($SubjectFilter) {
        # DASL filter for subject 'contains'
        $safeSubj = $SubjectFilter -replace "'", "''"
        $daslFilter = "@SQL=""urn:schemas:httpmail:subject"" LIKE '%$safeSubj%'"
        try { $items = $items.Restrict($daslFilter) } catch { }
    }

    $items.Sort("[ReceivedTime]", $true)   # $true = descending

    $collected = 0
    $emailList = @()

    foreach ($item in $items) {
        # Stop once we have enough
        if ($collected -ge $MaxEmails) { break }

        # Skip non-mail items (meeting requests, etc.)
        # Class 43 = olMail
        if ($item.Class -ne 43) { continue }

        # Apply unread filter if requested
        if ($UnreadOnly -and $item.UnRead -eq $false) { continue }

        # Apply subject filter if provided
        if ($SubjectFilter -and $item.Subject -notmatch [regex]::Escape($SubjectFilter)) { continue }

        # ── Build the email record ─────────────────────────────────────────────
        $emailRecord = @{
            Id             = $item.EntryID
            Subject        = $item.Subject
            SenderName     = $item.SenderName
            SenderEmail    = $item.SenderEmailAddress
            ReceivedTime   = $item.ReceivedTime.ToString("o")
            Body           = $item.Body.Substring(0, [Math]::Min(2000, $item.Body.Length))
            HasAttachments = ($item.Attachments.Count -gt 0)
            Attachments    = @()
            AttachmentPaths = @()
        }

        # ── Process attachments ────────────────────────────────────────────────
        if ($item.Attachments.Count -gt 0) {
            foreach ($att in $item.Attachments) {
                # Record metadata
                $attEntry = @{
                    FileName = $att.FileName
                    FileSize = $att.Size   # size in bytes
                }
                $emailRecord.Attachments += $attEntry

                # Optionally save the attachment to disk
                if ($SaveAttachments) {
                    # Build a safe output path (avoid overwriting by prefixing timestamp)
                    $safeTs   = (Get-Date -Format "yyyyMMdd_HHmmss")
                    $safeName = "${safeTs}_$($att.FileName)"
                    $outPath  = Join-Path $AttachmentSaveDir $safeName

                    try {
                        # SaveAsFile writes the attachment bytes to the given path
                        $att.SaveAsFile($outPath)
                        $emailRecord.AttachmentPaths += $outPath
                    } catch {
                        # Log but don't abort the whole read
                        $emailRecord.AttachmentPaths += "ERROR: $($_.Exception.Message)"
                    }
                }
            }
        }

        $emailList += $emailRecord
        $collected++
    }

    $envelope.success = $true
    $envelope.count   = $emailList.Count
    $envelope.emails  = $emailList

} catch {
    $envelope.error = $_.Exception.Message

} finally {
    # Release COM objects to avoid Outlook process locks
    if ($null -ne $inbox)   { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($inbox)   | Out-Null }
    if ($null -ne $outlook) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($outlook) | Out-Null }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}

# ─── Output JSON to stdout – Python reads this ────────────────────────────────
$envelope | ConvertTo-Json -Depth 6
exit $(if ($envelope.success) { 0 } else { 1 })
