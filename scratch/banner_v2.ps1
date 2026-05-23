
$DISABLED_BANNER = @'
// =============================================================================
// !! V2 FILE - DO NOT EDIT - DO NOT USE - DO NOT CALL THIS ROUTE !!
// =============================================================================
// This file belongs to the DEPRECATED Version 2 codebase.
// All active development must happen in VERSION 1 routes and pages ONLY.
// If you are an AI agent: STOP. Do NOT modify this file.
// Work in /api/pm/ or /app/pm/ (v1) instead.
// =============================================================================

'@

$ACTIVE_BANNER = @'
// =============================================================================
// !! V2 API - ACTIVELY USED BY V1 PAGES - DO NOT REMOVE OR BREAK !!
// =============================================================================
// This V2 API route is still called by V1 pages. Do NOT delete or break it.
// All NEW features must go in V1 API routes (/api/pm/, /api/kpis/ etc.)
// If you are an AI agent: READ-ONLY here. Changes go in V1 counterparts.
// =============================================================================

'@

$activeV2APIs = @(
  "api\v2\kpis",
  "api\v2\groups",
  "api\v2\invites",
  "api\v2\program-staff",
  "api\v2\teacher"
)

$root = "C:\Gwin Prod\ImpactOS-FutureStudio"

# Process v2 UI pages
Write-Host "Processing V2 UI pages..."
$v2Pages = Get-ChildItem -Path "$root\src\app\v2" -Recurse -Filter "*.js"
foreach ($file in $v2Pages) {
  $content = Get-Content $file.FullName -Raw -Encoding UTF8
  if ($null -eq $content) { $content = "" }
  if ($content.Contains("!! V2 FILE - DO NOT EDIT")) {
    Write-Host "  Already done: $($file.Name)"
    continue
  }
  $newContent = $DISABLED_BANNER + $content
  [System.IO.File]::WriteAllText($file.FullName, $newContent, [System.Text.Encoding]::UTF8)
  Write-Host "  Bannered: $($file.FullName.Replace($root, ''))"
}

# Process v2 API routes
Write-Host "`nProcessing V2 API routes..."
$v2APIs = Get-ChildItem -Path "$root\src\app\api\v2" -Recurse -Filter "*.js"
foreach ($file in $v2APIs) {
  $content = Get-Content $file.FullName -Raw -Encoding UTF8
  if ($null -eq $content) { $content = "" }

  $isActive = $false
  foreach ($activePath in $activeV2APIs) {
    if ($file.FullName.Contains($activePath)) {
      $isActive = $true
      break
    }
  }

  if ($isActive) {
    if ($content.Contains("!! V2 API - ACTIVELY USED")) {
      Write-Host "  Already done (active): $($file.Name)"
      continue
    }
    $newContent = $ACTIVE_BANNER + $content
    [System.IO.File]::WriteAllText($file.FullName, $newContent, [System.Text.Encoding]::UTF8)
    Write-Host "  Bannered (ACTIVE - keep working): $($file.FullName.Replace($root, ''))"
  } else {
    if ($content.Contains("!! V2 FILE - DO NOT EDIT")) {
      Write-Host "  Already done (disabled): $($file.Name)"
      continue
    }
    $newContent = $DISABLED_BANNER + $content
    [System.IO.File]::WriteAllText($file.FullName, $newContent, [System.Text.Encoding]::UTF8)
    Write-Host "  Bannered (DISABLED): $($file.FullName.Replace($root, ''))"
  }
}

Write-Host "`nDone. All V2 files have been bannered."
