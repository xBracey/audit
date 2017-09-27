const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const chromeLauncher = require('lighthouse/chrome-launcher');
const fs = require('fs');
const flags = {};
const queueClass = require('./queue');
const w3cjs = require('w3cjs');
const ReportGeneratorV2 = require('./node_modules/lighthouse/lighthouse-core/report/v2/report-generator');
const jsonfile = require('jsonfile');
const settingsJSON = jsonfile.readFileSync('settings.json');
const psi = require('psi');

async function login(page,url)
{
	await page.goto(url+settingsJSON.loginPage);
	await page.focus(settingsJSON.userNameCSS);
	await page.type(settingsJSON.userName);
	await page.focus(settingsJSON.passwordCSS);
	await page.type(settingsJSON.password);
	await page.click(settingsJSON.loginButtonCSS);
	await page.waitFor(1000);
}

async function loremIpsum(page)
{
	pageText = await page.plainText();
	pageText = pageText.toLowerCase();
	if (pageText.indexOf(settingsJSON.findText.toLowerCase())!== -1)
	{
		return true;
	}
	return false;
}

async function bfsGetPages(firstPage,url,dir)
{
	var browser = await puppeteer.launch();
	var browserPage = await browser.newPage();
	var pageList = [];
	var linkList=[];
	var loremIpsumList=[];
	var pageQueue = new queueClass.queue();
	pageQueue.enqueue(firstPage);
	pageList.push(firstPage);
	if(process.argv.indexOf("--pages") != -1)
	{
		for (var i=0;i<settingsJSON.pages.length;i++)
		{
			pageQueue.enqueue(settingsJSON.pages[i]);
			pageList.push(settingsJSON.pages[i]);
		}
	}
	if(process.argv.indexOf("--login") != -1)
	{
		await login(browserPage,url);
	}
	if(process.argv.indexOf("--link") != -1)
	{
		var linkBoolean = true;
	}
	else{var linkBoolean = false;}
	if(process.argv.indexOf("--timeout") != -1)
	{
		var timeOutBoolean = true;
	}
	else{var timeOutBoolean = false;}

	//Start of Breadth-First Search on website
	while (!pageQueue.isEmpty())
	{
		var page = pageQueue.dequeue();

		await browserPage.goto(url+page);
		if(timeOutBoolean)
		{
			if (page.indexOf(settingsJSON.timeout.page) !== -1)
			{
				await browserPage.waitFor(settingsJSON.timeout.time);
			}
		}
		var loremBoolean = await loremIpsum(browserPage);
		if (loremBoolean)
		{
			loremIpsumList.push(page);
		}
		var links = await browserPage.evaluate(() => {
			anchorArray = document.querySelectorAll('a');
			var links=[];
			for(var i=0;i<anchorArray.length;i++){
			   links.push(anchorArray[i].href);
			}
			return links;
		});
		for (var i=0;i<links.length;i++)
		{
			var linkHref = links[i];

			if(linkBoolean)
			{
				if (linkHref.indexOf(settingsJSON.linkString) !== -1)
				{
					linkList.push({"page": page, "href":linkHref});
				}
			}

			linkHref = linkHref.split("#")[0];
			var pageExtension = linkHref.split(".");
			pageExtension = pageExtension[pageExtension.length-1];

			var pageWithoutURL = linkHref.replace(url+"/","");
			if (linkHref!==pageWithoutURL)
			{
				pageWithoutURL = "/"+pageWithoutURL;
				if (pageList.indexOf(pageWithoutURL) === -1)
				{
					var excludedPage = false;
					for (j=0;j<settingsJSON.exclusions.length;j++)
					{	
						if (pageWithoutURL.indexOf(settingsJSON.exclusions[j]) !== -1)
						{
							excludedPage = true;
						}
					}
					if ((pageExtension.length>4) && (!excludedPage))
					{
						pageQueue.enqueue(pageWithoutURL);
						pageList.push(pageWithoutURL);
					}
				}
			}
		}
	}
	if(linkBoolean)
	{
		await preJSONScreenshot(linkList,browserPage);
		await browserPage.screenshot({path: dir+'/linkList.png',fullPage: true});
		fs.writeFile(dir+'/linkList.JSON', JSON.stringify(linkList), (err) => {
	  		if (err) throw err;
		});
		count = {};
		for (i=0;i<linkList.length;i++)
		{
			if (!count.hasOwnProperty(linkList[i].href))
			{
				count[linkList[i].href] == 0;
			}
			count[linkList[i].href] += 1;
		}
		fs.writeFile(dir+'/count.JSON', JSON.stringify(count), (err) => {
	  		if (err) throw err;
		});
	}
	fs.writeFile(dir+'/lorem.JSON', JSON.stringify(loremIpsumList), (err) => {
	  	if (err) throw err;
	});

	browser.close();
	return pageList;
}

async function takeScreenshots(page,listOfPages,i,pageName,url,dir)
{
	await page.setViewport({width: 1920, height: 1080});
	await page.goto(url+listOfPages[i]);
	await page.screenshot({path: dir+'/images/'+pageName+'.png', fullPage: true});
	await page.setViewport({width: 800, height: 1280});
	await page.screenshot({path: dir+'/smallImages/'+pageName+'.png', fullPage: true});
	await page.setViewport({width: 320, height: 568, isMobile: true});
	await page.screenshot({path: dir+'/mobileImages/'+pageName+'.png', fullPage: true});
}

async function getMarkupResults(page,listOfPages,i,pageName,url,dir)
{
	w3cjs.validate({
		file: url+listOfPages[i],
		output: 'html',
		callback: function (err, res) {
			fs.writeFile(dir+'/markupValidator/'+pageName+'_markup.html', res, (err) => {
	  		if (err) throw err;
			});
		}
	});
}

async function createScreenshots(listOfPages,dir,url)
{
	var browser = await puppeteer.launch();
	var page = await browser.newPage();
	var pagesLength = listOfPages.length;
	if(process.argv.indexOf("--login") != -1)
	{
		await login(page,url);
	}
	for (var i=0;i<pagesLength;i++)
	{
		var pageName = listOfPages[i].replace(/\//g,'_');
		pageName = pageName.replace(/#/g,'');
		await takeScreenshots(page,listOfPages,i,pageName,url,dir);
		await getMarkupResults(page,listOfPages,i,pageName,url,dir);
	}
	browser.close();
}

function launchChromeAndRunLighthouse(url, config = null) {
  return chromeLauncher.launch().then(chrome => {
    flags.port = chrome.port;
    return lighthouse(url, flags, config).then(results =>
      chrome.kill().then(() => results));
  });
}

function saveLightHouseReport(arrayNum,dir,allPages,results)
{
	var pageName = allPages[arrayNum].replace(/\//g,'_');
	var html = new ReportGeneratorV2().generateReportHtml(results);
	pageName = pageName.replace(/#/g,'');
	fs.writeFile(dir+'/lighthouse/'+pageName+'_report.html', html, (err) => {
	  	if (err) throw err;
	});
}

async function parallelLighthouseReports(allPages,dir,url,j,parallelNum)
{
	var pagesLength = allPages.length;
	for (var i=0;i<Math.ceil(pagesLength/parallelNum);i++)
	{
		var arrayNum = (i*parallelNum)+j;
		if (arrayNum < pagesLength)
		{
			await launchChromeAndRunLighthouse(url+allPages[arrayNum]).then(results => saveLightHouseReport(arrayNum,dir,allPages,results));
		}
	}
}
function createLighthouseReports(allPages,dir,url)
{
	var parallelNum = settingsJSON.parallel;
	if(!(typeof parallelNum==='number' && (parallelNum%1)===0)) {
		// parallelNum is not an integer
		parallelNum = 1;
	}
	for (var j=0;j<parallelNum;j++)
	{
		parallelLighthouseReports(allPages,dir,url,j,parallelNum).catch(console.error.bind(console));
	}
}
async function preJSONScreenshot(json,page)
{
	await page.goto("http://chris.photobooks.com/json/default.htm");
	await page.focus("#jsonInput");
	await page.type(JSON.stringify(json));
	await page.click("#jsonTrunc");
	await page.click("#cmdRender");
	await page.waitFor(1000);
}
async function createPageSpeedReports(pageList,dir,url)
{
	var browser = await puppeteer.launch();
	var page = await browser.newPage();
	var pageSpeedArray = {};
	for (var i=0;i<pageList.length;i++)
	{
		var pageSpeed = {};
		await psi(url+pageList[i],{key: settingsJSON.pageSpeedKey}).then(data => {
			pageSpeed.speed = data.ruleGroups.SPEED;
			pageSpeed.usability = data.ruleGroups.USABILITY;
		});
		pageSpeedArray[pageList[i]] = pageSpeed;
	}
	await preJSONScreenshot(pageSpeedArray,page);
	await page.screenshot({path: dir+'/pageSpeedReport.png',fullPage: true});
	browser.close();
}

function createDirectories(dir)
{
    if (!fs.existsSync(dir)){    
    	fs.mkdirSync(dir);
    	fs.mkdirSync(dir+'/images');
    	fs.mkdirSync(dir+'/mobileImages');
    	fs.mkdirSync(dir+'/smallImages');
    	fs.mkdirSync(dir+'/lighthouse');
    	fs.mkdirSync(dir+'/markupValidator');
	}
}

async function audit()
{
	console.time("bfsTimer");
	if((process.argv.indexOf("--url") != -1) && (process.argv.indexOf("--dir") != -1)){ 
	    var url = process.argv[process.argv.indexOf("--url") + 1];
	    var dir = process.argv[process.argv.indexOf("--dir") + 1];
	    if (url.slice(-1)==="/")
		{
			url = url.slice(0,-1);
		}
	    createDirectories(dir);
	    var pageList = await bfsGetPages("/",url,dir).catch(console.error.bind(console));
	    if(process.argv.indexOf("--pageSpeed") != -1)
		{
			await createPageSpeedReports(pageList,dir,url);
		}
		console.timeEnd("bfsTimer")
		createLighthouseReports(pageList,dir,url);
		createScreenshots(pageList,dir,url).catch(console.error.bind(console));
	}
	else
	{
		console.log("**************************************************");
		console.log("URL needs to be passed using the following syntax");
		console.log("node audit.js --url <URL> --dir <Directory Name>");
		console.log("**************************************************");
	}
}
audit().catch(console.error.bind(console));
