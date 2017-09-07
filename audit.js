const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const chromeLauncher = require('lighthouse/chrome-launcher');
const fs = require('fs');
const flags = {};
const queueClass = require('./queue');
const w3cjs = require('w3cjs');
const ReportGeneratorV2 = require('./node_modules/lighthouse/lighthouse-core/report/v2/report-generator');

async function bfsGetPages(firstPage,url)
{
	var browser = await puppeteer.launch();
	var browserPage = await browser.newPage();
	var pageList = [];
	// linkList=[];//For seeing links
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
			// if (tempHref.indexOf("page_id=535") !== -1)//For seeing links
			// {
			// 	linkList.push({"page": page, "href":tempHref});
			// }
			tempHref = tempHref.split("#")[0];
			ext = tempHref.split(".");
			ext = ext[ext.length-1];

			var newPage = tempHref.replace(url,"");
			if ((tempHref!==newPage) && (pageList.indexOf(newPage) === -1))
			{
				if (ext.length>4)
				{
					pageQueue.enqueue(newPage);
					pageList.push(newPage);
				}
			}
		}
	}
	// console.log(linkList); //For seeing links
	browser.close();
	return pageList;
}

async function takeScreenshots(page,listOfPages,i,pageName,url,dir)
{
	await page.setViewport({width: 1920, height: 1080});
	await page.goto(url+listOfPages[i]);
	await page.screenshot({path: dir+'/images/'+pageName+'.png', fullPage: true});
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
	  			//console.log('The file has been saved!');
			});
		}
	});
}

async function createScreenshots(listOfPages,dir,url)
{
	var browser = await puppeteer.launch();
	var page = await browser.newPage();
	var pagesLength = listOfPages.length;
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
			await launchChromeAndRunLighthouse(url+allPages[arrayNum]).then(results => saveLightHouseReport(arrayNum,dir,allPages,results));
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
