# Audit
Auditing script for producing desktop and mobile screenshots, markup validator screenshots and lighthouse reports given a URL

## Prerequisites 
1. Node v7.6.0 or above
2. Clone this Git repository into a new directory

## Run Audit Tool
To run the auditing tool, all you need is the __URL__ of the home page of the website/staging site

```node audit.js --url <URL> ```

## Results
Results of the auditing tool can be found in the four directories of the installation directory.

### Lighthouse Reports
The reports found in the __/lighthouse__ folder can be viewed as html using the following address https://googlechrome.github.io/lighthouse/viewer/
