param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Tag,
  [Parameter(Position = 1)]
  [string]$Message = "Healthora release $Tag"
)

$ErrorActionPreference = "Stop"

if (-not (git rev-parse --is-inside-work-tree 2>$null)) {
  Write-Error "Not inside a git repository."
}

$dirty = git status --porcelain
if ($dirty) {
  Write-Error "Working tree is dirty. Commit or stash changes before tagging."
}

$exists = git tag -l $Tag
if ($exists) {
  Write-Error "Tag '$Tag' already exists."
}

git tag -a $Tag -m $Message
Write-Host "Created tag $Tag"
Write-Host "Push with: git push origin $Tag"
