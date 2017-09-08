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

### Settings
#### Parallel lighthouse instances
The tool produces a lighthouse report for every page that it finds. Each report takes time to produce so reports can be produced in parallel. You can change how many reports are produced in parallel in the settings.json file under the name "parallel". The default value is 5 lighthouse istances

#### Login Page
If the website you are auditing requires a login to access all of the pages, there are some settings you can change so the tool automatically logins before any operations are performed. These settings (which are found in the settings.json file) include:
* __loginPage__ : The page where the user logins (i.e /login or /auth/login)
* __userName__ : The value of the username/email that the user would use to login (i.e admin or admin@email.com)
* __userNameCSS__ : A unique CSS selector that identifies the text input where the user would enter their username (i.e "input[id='username']")
* __password__ : The value of the password that the user would use to login (i.e admin or password)
* __passwordCSS__ : A unique CSS selector that identifies the text input where the user would enter their password (i.e "input[id='password']")
* __loginButtonCSS__ : A unique CSS selector that identifies the button which the user would click after their username and password has been entered (i.e "input[id='login']")
* __logOutPage__ : The page where the user logs out (i.e /logout or /auth/logout) so the program does not click any link that logs the user out

To include this feature, append the --login tag like in the text below:

```node audit.js --url <URL> --dir <Directory Name> --login``` 

#### Find links
If you suspect some links are redirecting the page to a different/old staging site or an old site, you can use another feature provided by this tool to find these links. Since the auditing tool checks every href in every anchor tag, any href that contains a substring of the old site's URL can be logged and saved as a JSON file.

To use this feature, specify a substring of the old site's URL in the settings.json file under the name "linkString" and append the --link tag.

What will be returned will be a JSON file containing an array of objects where each object represents a link. The object's page is where the link was found and the object's href is the href attribute of the link. The JSON file can be found in the directory created by the tool.

To view the JSON in a nice readable format, open the following page http://chris.photobooks.com/json/default.htm and paste the generated JSON into the input.

#### Manually add pages
Sometimes there are  pages which can't be accessed from the home page or can't be accessed from clicking a link (For example a search page which requires the user to type a string into a text bar and hit search). These pages can be searched through as well by adding them to the pages array in the settings.json file. All pages should start with the character '/'.

## Results
Results of the auditing tool can be found in the four directories of the directory created by the tool. The four folders are as follows:
* __Images__ : Contains screenshots of all of the pages
* __Lighthouse__ : Contains lighthouse reports in html of all of the pages
* __MarkupValidator__ : Contains markup validator reports in html for all of the pages
* __MobileImages__ : Contains mobile screenshots of all of the pages
