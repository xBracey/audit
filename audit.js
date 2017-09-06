const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const chromeLauncher = require('lighthouse/chrome-launcher');
const fs = require('fs');
const flags = {};
const queueClass = require('./queue');

async function bfsGetPages(firstPage,url)
{
	var browser = await puppeteer.launch({
		executablePath: '/usr/bin/google-chrome',
		args: [
        		'--no-sandbox',
            		'--disable-setuid-sandbox'
		]
	});
	var browserPage = await browser.newPage();
	var pageList = [];
	// linkList=[];
	var pageQueue = new queueClass.queue();
	pageQueue.enqueue(firstPage);
	pageList.push(firstPage);
	while (!pageQueue.isEmpty())
	{
		var page = pageQueue.dequeue();
		await browserPage.goto(url+page);
		var numOfLinks = await browserPage.evaluate(() => {
			return document.querySelectorAll('a').length;
		});
		for (var i=0;i<numOfLinks;i++)
		{
			var tempHref = await browserPage.evaluate((i) => {
				return document.querySelectorAll('a')[i].href;
			},i);
			// if (tempHref.indexOf("staging-cop-web-elb") !== -1)
			// {
			// 	linkList.push({"page": page, "href":tempHref});
			// }
			tempHref = tempHref.split("#")[0];
			var newPage = tempHref.replace(url,"");
			if ((tempHref!==newPage) && (pageList.indexOf(newPage) === -1))
			{
				pageQueue.enqueue(newPage);
				pageList.push(newPage);
			}
		}
	}
	// console.log(linkList);
	browser.close();
	return pageList;
}

async function takeScreenshot(page,listOfPages,i,pageName,url,dir)
{
	await page.setViewport({width: 1920, height: 1080});
	await page.goto(url+listOfPages[i]);
	await page.screenshot({path: dir+'/images/'+pageName+'.png', fullPage: true});
}

async function takeMarkupScreenshot(page,listOfPages,i,pageName,url,dir)
{
	await page.setViewport({width: 1920, height: 1080});
	await page.goto('https://validator.w3.org/');
	await page.focus('#uri');
	await page.type(url+listOfPages[i]);
	await page.click('#validate-by-uri .submit');
	await page.waitFor(3000);
	await page.screenshot({path: dir+'/markupValidator/'+pageName+'.png', fullPage: true});
}

async function takeMobileScreenshot(page,listOfPages,i,pageName,url,dir)
{
	await page.setViewport({width: 320, height: 568, isMobile: true});
	await page.goto(url+listOfPages[i]);
	await page.screenshot({path: dir+'/mobileImages/'+pageName+'.png', fullPage: true});
}

async function createScreenshots(listOfPages,dir,url)
{
	var browser = await puppeteer.launch();
	var page = await browser.newPage();
	var pagesLength = listOfPages.length;
	for (var i=0;i<pagesLength;i++)
	{
		if (listOfPages[i].slice(-4) !== '.pdf')
		{
			var pageName = listOfPages[i].replace(/\//g,'_');
			pageName = pageName.replace(/#/g,'');
			await takeScreenshot(page,listOfPages,i,pageName,url,dir);
			await takeMarkupScreenshot(page,listOfPages,i,pageName,url,dir);
			await takeMobileScreenshot(page,listOfPages,i,pageName,url,dir);
		}
	}
	browser.close();
}

function launchChromeAndRunLighthouse(url, flags = {}, config = null) {
  return chromeLauncher.launch().then(chrome => {
    flags.port = chrome.port;
    return lighthouse(url, flags, config).then(results =>
      chrome.kill().then(() => results));
  });
}

function saveLightHouseReport(arrayNum,dir,allPages,results)
{
	var pageName = allPages[arrayNum].replace(/\//g,'_');	
	pageName = pageName.replace(/#/g,'');
	fs.writeFile(dir+'/lighthouse/'+pageName+'_report.JSON', JSON.stringify(results), (err) => {
	  	if (err) throw err;
	  	//console.log('The file has been saved!');
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
			await launchChromeAndRunLighthouse(url+allPages[arrayNum], flags).then(results => saveLightHouseReport(arrayNum,dir,allPages,results));
		}
	}
}
function createLighthouseReports(allPages,dir,url)
{
	if(process.argv.indexOf("--parallel") != -1)
	{
		var parallelNum = parseInt(process.argv[process.argv.indexOf("--parallel") + 1]);
		if(!(typeof parallelNum==='number' && (parallelNum%1)===0)) {
    		// parallelNum is not an integer
    		parallelNum = 1;
		}
	}
	else
	{
		var parallelNum = 1;
	}
	for (var j=0;j<parallelNum;j++)
	{
		parallelLighthouseReports(allPages,dir,url,j,parallelNum).catch(console.error.bind(console));
	}
}

async function audit()
{
	if((process.argv.indexOf("--url") != -1) && (process.argv.indexOf("--dir") != -1)){ //does our flag exist?
	    var url = process.argv[process.argv.indexOf("--url") + 1]; //grab the next item
	    if (url.slice(-1)==="/")
		{
			url = url.slice(0,-1);
		}
	    var dir = process.argv[process.argv.indexOf("--dir") + 1]; //grab the next item
	    if (!fs.existsSync(dir)){
	    	fs.mkdirSync(dir);
	    	fs.mkdirSync(dir+'/images');
	    	fs.mkdirSync(dir+'/mobileImages');
	    	fs.mkdirSync(dir+'/lighthouse');
	    	fs.mkdirSync(dir+'/markupValidator');
		}
	    var pageList = await bfsGetPages("/",url).catch(console.error.bind(console));
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
