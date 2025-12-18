# User Configuration
$scan_dirs = @("src")
$ignore_paths = @("node_modules")
$ignore_wildcards = @("expo-env.d.ts", "next-env.d.ts")
$root_files = @("drizzle.config.ts")  # e.g. package.json
$allowed_extensions = @("ts")

# Build ignore clause
function Get-IgnorePredicate {
    param($path)
    foreach ($ignore in $ignore_paths + $ignore_wildcards) {
        if ($ignore -and $path -match [Regex]::Escape($ignore)) {
            return $false
        }
    }
    return $true
}

# Build extension predicate
function Get-ExtensionPredicate {
    param($path)
    $ext = [System.IO.Path]::GetExtension($path).TrimStart(".")
    return $allowed_extensions -contains $ext
}

# Find files (root + dirs)
function Find-Files {
    $files = @()
    foreach ($file in $root_files) {
        if ($file -and (Test-Path -LiteralPath "./$file")) {
            $files += (Resolve-Path -LiteralPath "./$file").Path
        }
    }
    foreach ($dir in $scan_dirs) {
        if (Test-Path -LiteralPath $dir) {
            $files += Get-ChildItem -LiteralPath $dir -Recurse -File | Where-Object {
                (Get-IgnorePredicate $_.FullName) -and (Get-ExtensionPredicate $_.FullName)
            } | Select-Object -ExpandProperty FullName
        }
    }
    return $files | Sort-Object
}

# Normalize consecutive newlines
function Normalize-Newlines {
    param($text)
    return ($text -replace "(\r?\n){3,}", "`r`n`r`n")
}

# Convert marimo file to notebook-style format
function Convert-MarimoToNotebook {
    param($content)

    # Check if it's a marimo file
    if ($content -notmatch '^\s*import marimo') {
        return $content
    }

    # Extract cells using regex to find @app.cell decorators and their content
    $cells = @()

    # Pattern to match @app.cell(...) followed by def function(): and its body
    $pattern = '(?ms)@app\.cell.*?\ndef [^(]+\([^)]*\):\s*\n(.*?)(?=\n@app\.cell|\nif __name__|\Z)'

    $matches = [regex]::Matches($content, $pattern)

    foreach ($match in $matches) {
        $cellBody = $match.Groups[1].Value

        # Remove leading indentation (typically 4 spaces)
        $lines = $cellBody -split "`n"
        $dedented = @()
        foreach ($line in $lines) {
            if ($line -match '^    (.*)$') {
                $dedented += $matches[0].Groups[1].Value
            } elseif ($line.Trim() -eq '') {
                $dedented += ''
            } else {
                $dedented += $line
            }
        }

        $cellContent = ($dedented -join "`n").Trim()
        if ($cellContent) {
            $cells += $cellContent
        }
    }

    # If no cells found with @app.cell pattern, try setup block
    if ($cells.Count -eq 0) {
        $setupPattern = '(?ms)with app\.setup\([^)]*\):\s*\n(.*?)(?=\n@app\.cell|\nif __name__|\Z)'
        $setupMatch = [regex]::Match($content, $setupPattern)

        if ($setupMatch.Success) {
            $setupBody = $setupMatch.Groups[1].Value

            # Remove leading indentation
            $lines = $setupBody -split "`n"
            $dedented = @()
            foreach ($line in $lines) {
                if ($line -match '^    (.*)$') {
                    $dedented += $matches[0].Groups[1].Value
                } elseif ($line.Trim() -eq '') {
                    $dedented += ''
                } else {
                    $dedented += $line
                }
            }

            $cellContent = ($dedented -join "`n").Trim()
            if ($cellContent) {
                $cells += $cellContent
            }
        }
    }

    # Format as notebook-style output
    if ($cells.Count -gt 0) {
        $output = ""
        for ($i = 0; $i -lt $cells.Count; $i++) {
            $output += "cell $($i + 1):`n`n"
            $output += $cells[$i] + "`n"
            if ($i -lt $cells.Count - 1) {
                $output += "`n---`n`n"
            }
        }
        return $output
    }

    # If parsing failed, return original content
    return $content
}

# Generate output
$output = "=== File Structure ===`n"
$files = Find-Files
foreach ($file in $files) {
    $relPath = Resolve-Path -LiteralPath $file -Relative
    $output += "$relPath`n"
}

$output += "`n=== File Contents ===`n"
foreach ($file in $files) {
    $relPath = Resolve-Path -LiteralPath $file -Relative
    $output += "`n// FILE: $relPath`n"
    $content = Get-Content -LiteralPath $file -Raw

    # Convert marimo files if it's a .py file
    if ([System.IO.Path]::GetExtension($file) -eq ".py") {
        $content = Convert-MarimoToNotebook $content
    }

    $output += (Normalize-Newlines $content) + "`n"
    $output += "---`n"
}

# Remove the last separator
$output = $output -replace "(?s)---\s*$", ""

# Normalize all newlines
$output = Normalize-Newlines $output

# Copy to clipboard if available
try {
    Set-Clipboard -Value $output
    Write-Host "Output copied to clipboard."
} catch {
    Write-Output $output
    Write-Host "Clipboard copy not available, printed to console."
}
