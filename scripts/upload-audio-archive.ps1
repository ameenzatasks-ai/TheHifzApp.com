<#
.SYNOPSIS
  Uploads the 604 page recitations to archive.org, which serves them to the
  Listen tab via VITE_AUDIO_BASE_URL.

.DESCRIPTION
  The recordings are ~2.47 GB — too large for the git repo or a free host's
  slug — so they are served from outside the deploy. archive.org is used
  because it needs no payment method, unlike R2 and B2.

  Run with -Pilot FIRST. It uploads a single page so the URL shape, playback
  and seeking can be confirmed in the app before committing to a multi-hour
  transfer of the whole Mus'haf.

  Note archive.org items are public and take effort to remove, so only upload
  recordings you are content to publish.

.EXAMPLE
  # 1. One file first — verify it plays in the app
  .\upload-audio-archive.ps1 -Identifier "hifz-app-ayman-suwayd-pages" -Pilot

  # 2. Then the rest
  .\upload-audio-archive.ps1 -Identifier "hifz-app-ayman-suwayd-pages"
#>
param(
  # Must be globally unique on archive.org and cannot be changed later.
  [Parameter(Mandatory = $true)] [string] $Identifier,
  # Left empty and resolved in the body: $PSScriptRoot is not yet populated
  # while param() defaults are evaluated, so referencing it here yields "".
  [string] $Source = '',
  [string] $Title  = "Qur'an page recitations (New Madani Mus'haf) - Ayman Suwayd",
  # Upload only page 1, to prove the pipeline before moving 2.47 GB.
  [switch] $Pilot,
  # Files per `ia upload` call. archive.org queues one ingest task per call and
  # makes the item unplayable while tasks run, so this must NOT be 1.
  [int] $BatchSize = 100,
  # How long to wait for archive.org's ingest queue to clear before uploading.
  [int] $MaxQueueWaitMinutes = 90,
  # Proceed once the queue is down to this many tasks. Waiting for absolute
  # zero stalls indefinitely on trailing tasks that do no real harm.
  [int] $QueueTolerance = 5
)

$ErrorActionPreference = 'Stop'

# Default to the copy that lives beside this repo. Hardcoding an absolute path
# is what silently broke this: the recordings moved when the old "The Hifz App"
# folder was merged in, and every run afterwards failed instantly on a path that
# no longer existed — so the upload appeared to be running and made no progress.
if (-not $Source) {
  $Source = Join-Path (Split-Path $PSScriptRoot -Parent) 'Page Audio Recordings'
}

# pip installs the console script into a Scripts directory that is often not on
# PATH — notably under the Microsoft Store build of Python — so resolve it
# directly rather than relying on the shell finding it.
function Resolve-IaExe {
  $onPath = Get-Command ia -ErrorAction SilentlyContinue
  if ($onPath) { return $onPath.Source }

  # pip reports where the package landed; the console script sits in a Scripts
  # directory alongside site-packages.
  $line = & pip show internetarchive 2>$null | Select-String '^Location:\s*(.+)$'
  if ($line) {
    $loc = $line.Matches[0].Groups[1].Value.Trim()
    $candidate = Join-Path (Split-Path $loc -Parent) 'Scripts\ia.exe'
    if (Test-Path $candidate) { return $candidate }
  }
  return $null
}

$ia = Resolve-IaExe
if (-not $ia) {
  Write-Host "The archive.org CLI was not found. Run:" -ForegroundColor Yellow
  Write-Host "  pip install internetarchive" -ForegroundColor Cyan
  Write-Host "  ia configure" -ForegroundColor Cyan
  exit 1
}

# Uploading needs credentials; without them every call fails one by one.
$configured = @(
  (Join-Path $env:USERPROFILE '.config\internetarchive\ia.ini'),
  (Join-Path $env:USERPROFILE '.ia'),
  (Join-Path $env:APPDATA 'internetarchive\ia.ini')
) | Where-Object { Test-Path $_ }

if (-not $configured) {
  Write-Host "No archive.org credentials found. Run this first:" -ForegroundColor Yellow
  Write-Host "  `"$ia`" configure" -ForegroundColor Cyan
  Write-Host "It asks for the email and password of your archive.org account."
  exit 1
}

if (-not (Test-Path $Source)) { throw "Source folder not found: $Source" }

$files = Get-ChildItem $Source -Filter *.mp3 | Sort-Object Name
if ($files.Count -eq 0) { throw "No .mp3 files found in $Source" }

if ($Pilot) {
  $files = $files | Select-Object -First 1
  Write-Host "PILOT: uploading $($files[0].Name) only" -ForegroundColor Cyan
} else {
  # Ask the item what it already holds and skip those. A 2.47 GB transfer is
  # very likely to be interrupted at least once, and without this every resume
  # would re-send everything from the beginning.
  Write-Host "Checking what is already uploaded..." -ForegroundColor DarkGray
  $meta = & $ia metadata $Identifier 2>$null
  if ($meta) {
    $present = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($m in [regex]::Matches($meta, '"name":\s*"([^"]+\.mp3)"')) {
      [void]$present.Add($m.Groups[1].Value)
    }
    if ($present.Count -gt 0) {
      $before = $files.Count
      $files = $files | Where-Object { -not $present.Contains($_.Name) }
      Write-Host "  $($present.Count) already present; $($before - $files.Count) skipped" -ForegroundColor DarkGray
    }
  }
  if ($files.Count -eq 0) {
    Write-Host "Everything is already uploaded." -ForegroundColor Green
    Write-Host "VITE_AUDIO_BASE_URL=https://archive.org/download/$Identifier" -ForegroundColor Cyan
    exit 0
  }

  $sizeGB = [math]::Round((($files | Measure-Object -Property Length -Sum).Sum / 1GB), 2)
  Write-Host "Uploading $($files.Count) files ($sizeGB GB) to item '$Identifier'" -ForegroundColor Cyan
  Write-Host "Re-running skips files already present, so an interrupted run is safe." -ForegroundColor DarkGray
}

# archive.org marks an item's servers unavailable while its ingest queue is
# running, which makes even already-uploaded tracks fail to play. Adding to a
# busy queue extends that outage, so wait for it to clear first.
if (-not $Pilot) {
  $waitedMin = 0
  while ($waitedMin -lt $MaxQueueWaitMinutes) {
    $meta = & $ia metadata $Identifier 2>$null
    if (-not $meta -or $meta -notmatch '"pending_tasks":\s*true') { break }
    $queued = ([regex]::Matches($meta, '"cmd":\s*"[^"]+"')).Count
    # Only a LARGE queue makes the item unavailable for long. A couple of
    # trailing tasks are harmless, and waiting on them once cost 90 minutes
    # and stalled the upload entirely.
    if ($queued -le $QueueTolerance) {
      Write-Host "  $queued task(s) outstanding - low enough to proceed" -ForegroundColor DarkGray
      break
    }
    Write-Host "  archive.org still processing ($queued task(s)); waiting..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 60
    $waitedMin++
  }
  if ($waitedMin -ge $MaxQueueWaitMinutes) {
    Write-Host "Queue still busy after $MaxQueueWaitMinutes min; continuing anyway." -ForegroundColor Yellow
  }
}

$failed = @()
$n = 0

# 'Stop' is right for the setup above, where any failure should halt. It is
# wrong for the loop: `ia` writing a progress bar to stderr would end the run
# on the first file. Failures here are detected by exit code instead.
$ErrorActionPreference = 'Continue'

# Files are sent in BATCHES, not one per call. archive.org queues a separate
# ingest task for every `ia upload` invocation, and while those tasks run it
# marks the item's servers unavailable — so uploading 604 files individually
# queues 604 tasks and makes the recordings unplayable for hours, including
# the ones that already finished. Batching keeps that queue to a handful.
$batches = [System.Collections.Generic.List[object]]::new()
for ($i = 0; $i -lt $files.Count; $i += $BatchSize) {
  $end = [Math]::Min($i + $BatchSize - 1, $files.Count - 1)
  $batches.Add(@($files[$i..$end]))
}
Write-Host "Sending in $($batches.Count) batch(es) of up to $BatchSize" -ForegroundColor DarkGray

foreach ($batch in $batches) {
  $n++
  Write-Progress -Activity "Uploading to archive.org" `
                 -Status "batch $n of $($batches.Count)  ($($batch.Count) files)" `
                 -PercentComplete (($n / $batches.Count) * 100)

  # `ia` draws its progress bar on stderr. Windows PowerShell turns a native
  # command's stderr into ErrorRecords whenever it is redirected — with 2>&1
  # OR 2>$null — and under $ErrorActionPreference = 'Stop' that aborts the run
  # on the very first file, even though the upload itself succeeded. So stderr
  # is left alone and success is judged by exit code only.
  $paths = $batch | ForEach-Object { $_.FullName }
  & $ia upload $Identifier @paths `
      --metadata="title:$Title" `
      --metadata="mediatype:audio" `
      --metadata="collection:opensource_audio" `
      --retries=3 | Out-Null

  if ($LASTEXITCODE -ne 0) {
    $failed += $batch | ForEach-Object { $_.Name }
    Write-Host "  batch $n failed" -ForegroundColor Red
  } else {
    Write-Host "  batch $n of $($batches.Count) done ($($batch.Count) files)" -ForegroundColor DarkGray
  }
}
Write-Progress -Activity "Uploading to archive.org" -Completed

if ($failed.Count -gt 0) {
  Write-Host "`n$($failed.Count) file(s) failed:" -ForegroundColor Red
  $failed | ForEach-Object { Write-Host "  $_" }
  Write-Host "Re-run the same command to retry only these." -ForegroundColor Yellow
  exit 1
}

$base = "https://archive.org/download/$Identifier"
Write-Host "`nUploaded $($files.Count) file(s)." -ForegroundColor Green
Write-Host "Test this URL in a browser (allow a minute for archive.org to process):" -ForegroundColor Yellow
Write-Host "  $base/$($files[0].Name)" -ForegroundColor Cyan
if ($Pilot) {
  Write-Host "`nIf it plays, re-run WITHOUT -Pilot to upload the rest." -ForegroundColor Yellow
} else {
  Write-Host "`nThen set on the host and redeploy:" -ForegroundColor Yellow
  Write-Host "  VITE_AUDIO_BASE_URL=$base" -ForegroundColor Cyan
}
