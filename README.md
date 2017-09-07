# Audit
Auditing script for producing desktop and mobile screenshots, markup validator screenshots and lighthouse reports given a URL

## Prerequisites 
1. Node v7.6.0 or above
2. Clone this Git repository into a new directory

## Installation
After cloning the git repo, execute the following lines on the command line in the root directory:
1. ```npm init -y```
2. ```npm install puppeteer lighthouse w3cjs```

## Run Audit Tool
To run the auditing tool, all you need is the __URL__ of the home page of the website/staging site and a __Directory Name__ which will store the results of the audit. The following should then be typed into the terminal:

```node audit.js --url <URL> --dir <Directory Name>```

### Parallel Lighthouse Instances
Another feature of the auditing tool is that in create many parallel lighthouse instances whilst auditing. To enable this use the following tag:
```--parallel <numOfInstances>```

## Results
Results of the auditing tool can be found in the four directories of the directory created by the tool. The four folders are as follows:
* __Images__ : Contains screenshots of all of the pages
* __Lighthouse__ : Contains lighthouse reports in html of all of the pages
* __MarkupValidator__ : Contains markup validator reports in html for all of the pages
* __MobileImages__ : Contains mobile screenshots of all of the pages
