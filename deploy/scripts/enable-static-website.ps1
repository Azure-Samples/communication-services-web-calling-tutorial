# $env:PackageUrl = 'https://github.com/Azure-Samples/communication-services-web-calling-tutorial/releases/latest/download/calling-tutorial-build.zip'
# $env:ResourceGroupName = 't-sanderv-basic-linux'
# $env:StorageAccountName = 'callingexamplestaticapp'

$storageAccount = Get-AzStorageAccount -ResourceGroupName $env:ResourceGroupName -AccountName $env:StorageAccountName

# Enable the static website feature on the storage account.
$ctx = $storageAccount.Context
Enable-AzStorageStaticWebsite -Context $ctx -IndexDocument index.html -ErrorDocument404Path index.html

# Download and extract the ZIP file
$ZipFile = "calling-example.zip"
$ExtractedDirectory = "calling-example"

Invoke-Webrequest -Uri $env:packageUrl -OutFile $ZipFile

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($ZipFile, $ExtractedDirectory)


# Upload the zip contents to the storages account
Set-AzStorageBlobContent -Context $ctx -Container '$web' -File $ExtractToDirectory+"/index.html" -Blob "index.html" -Properties @{'ContentType' = 'text/html'} -Force
Set-AzStorageBlobContent -Context $ctx -Container '$web' -File $ExtractToDirectory+"/bundle.js" -Blob "bundle.js" -Properties @{'ContentType' = 'text/javascript'} -Force