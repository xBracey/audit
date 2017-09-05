const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const chromeLauncher = require('lighthouse/chrome-launcher');
const fs = require('fs');
const flags = {};
const queueClass = require('./queue');

async function bfsGetPages(firstPage,url)
{
	var browser = await puppeteer.launch();
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

async function parallelScreenshots(listOfPages,dir,url,j,parallelNum)
{
	var browser = await puppeteer.launch();
	var page = await browser.newPage();
	var pagesLength = listOfPages.length;
	for (var i=0;i<Math.ceil(pagesLength/parallelNum);i++)
	{
		var arrayNum = (i*parallelNum)+j;
		console.log(arrayNum);
		if (arrayNum < pagesLength)
		{
			if (listOfPages[arrayNum].slice(-4) !== '.pdf')
			{
				await page.setViewport({width: 1920, height: 1080});
				var pageName = listOfPages[arrayNum].replace(/\//g,'_');
				pageName = pageName.replace(/#/g,'');
				await page.goto(url+listOfPages[arrayNum]);
				await page.screenshot({path: dir+'/images/'+pageName+'.png', fullPage: true});

				await page.goto('https://validator.w3.org/');
				await page.focus('#uri');
				await page.type(url+listOfPages[arrayNum]);
				await page.click('#validate-by-uri .submit');
				await page.waitFor(3000);
				await page.screenshot({path: dir+'/markupValidator/'+pageName+'.png', fullPage: true});

				await page.setViewport({width: 320, height: 568, isMobile: true});
				await page.goto(url+listOfPages[arrayNum]);
				await page.screenshot({path: dir+'/mobileImages/'+pageName+'.png', fullPage: true});
			}
		}
	}
	browser.close();
}

function createScreenshots(listOfPages,dir,url)
{
	var parallelNum = 8;
	for (var j=0;j<parallelNum;j++)
	{
		parallelScreenshots(listOfPages,dir,url,j,parallelNum).catch(console.error.bind(console));
	}
}

function launchChromeAndRunLighthouse(url, flags = {}, config = null) {
  return chromeLauncher.launch().then(chrome => {
    flags.port = chrome.port;
    return lighthouse(url, flags, config).then(results =>
      chrome.kill().then(() => results));
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
			await launchChromeAndRunLighthouse(url+allPages[arrayNum], flags).then(results => {
				var pageName = allPages[arrayNum].replace(/\//g,'_');	
				pageName = pageName.replace(/#/g,'');
				fs.writeFile(dir+'/lighthouse/'+pageName+'_report.JSON', JSON.stringify(results), (err) => {
				  	if (err) throw err;
				  	//console.log('The file has been saved!');
				});
			});
		}
	}
}
function createLighthouseReports(allPages,dir,url)
{
	parallelNum = 4;
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
		parallelScreenshots(pageList,dir,url,0,1).catch(console.error.bind(console));
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
