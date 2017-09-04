const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const chromeLauncher = require('lighthouse/chrome-launcher');
const fs = require('fs');
const flags = {};

async function getPagesInitial(url,dir){
	var browser = await puppeteer.launch();
	var page = await browser.newPage();
	page.setViewport({width: 1920, height: 1080});

	if (!fs.existsSync(dir)){
    	fs.mkdirSync(dir);
    	fs.mkdirSync(dir+'/images');
    	fs.mkdirSync(dir+'/mobileImages');
    	fs.mkdirSync(dir+'/lighthouse');
    	fs.mkdirSync(dir+'/markupValidator');
	}

	await page.goto(url);
	var pageList =[];
	pageList = await getPages("/",pageList,url,"/",page);
	browser.close();
	return pageList;
}

async function getHref(j,browserPage)
{
	var tempHref = await browserPage.evaluate((j) => {
		var x = document.querySelectorAll('a')[j];
		if (x != undefined)
		{
			if (x != undefined)
			{
				return x.href;
			}
			else {return 'undefined';}
		}
		else {return 'undefined';}
	},j);
	return tempHref;
}
async function getPages(page,pageList,addr,pageBefore,browserPage)
{
	// if (page.indexOf("insights") !== -1)
	// {
	// 	await browserPage.waitFor(1000);
	// }
	pageList.push(page);
	var numOfLinks = await browserPage.evaluate(() => {
		return document.querySelectorAll('a').length;
	});
	for (var j=0; j < numOfLinks; j++) {
		// if ((page.indexOf("insights/page") !== -1) || (page===("/insights")))
		// {
		// 	await browserPage.waitFor(1000);
		// }
		try {
			var tempHref = await getHref(j,browserPage);
		}
		catch(e)
		{
			console.log("Catch1");
			try {
				var tempHref = await getHref(j,browserPage);
			}
			catch(e)
			{
				console.log("Catch2");
				try {
					var tempHref = await getHref(j,browserPage);
				}
				catch(e)
				{
					console.log("Catch3");
					try {
						var tempHref = await getHref(j,browserPage);
					}
					catch(e)
					{
						throw "Get HREF of element failed";
					}
				}
			}
		}
		//check if the link is in the same domain as the initial address
		tempHref = tempHref.split("#")[0];
		var newPage = tempHref.replace(addr,"");
		if ((tempHref!==newPage) && (pageList.indexOf(newPage) === -1))
		{
			await browserPage.evaluate((j) => {
				x = document.querySelectorAll('a')[j];
				x.click()
			},j);
			pageList = await getPages(newPage,pageList,addr,page,browserPage);
		}
	}
	await browserPage.goto(addr+pageBefore);
	return pageList;
}

function launchChromeAndRunLighthouse(url, flags = {}, config = null) {
  return chromeLauncher.launch().then(chrome => {
    flags.port = chrome.port;
    return lighthouse(url, flags, config).then(results =>
      chrome.kill().then(() => results));
  });
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
				pageName = listOfPages[arrayNum].replace(/\//g,'_');
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
	parallelNum = 8;
	for (var j=0;j<parallelNum;j++)
	{
		parallelScreenshots(listOfPages,dir,url,j,parallelNum).catch(console.error.bind(console));
	}
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
	    var pageList = await getPagesInitial(url,dir).catch(console.error.bind(console));
	    console.log(pageList);
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
