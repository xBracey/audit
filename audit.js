const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const chromeLauncher = require('lighthouse/chrome-launcher');
const fs = require('fs');
const flags = {};

async function getPagesInitial(url,dir){
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	page.setViewport({width: 1920, height: 1080});

	if (!fs.existsSync(dir)){
    	fs.mkdirSync(dir);
    	fs.mkdirSync(dir+'/images');
    	fs.mkdirSync(dir+'/mobileImages');
    	fs.mkdirSync(dir+'/lighthouse');
    	fs.mkdirSync(dir+'/markupValidator');
	}

	if (url.slice(-1)==="/")
	{
		url = url.slice(0,-1);
	}
	await page.goto(url);
	var pageList =[];
	pageList = await getPages("/",pageList,url,"/",page);
	browser.close();
	createLighthouseReports(pageList,dir,url).catch(console.error.bind(console));
	screenshots(pageList,dir,url).catch(console.error.bind(console));
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
		console.log('start');
		console.log(j);
		var tempHref = await browserPage.evaluate((j) => {
			x = document.querySelectorAll('a')[j];
			if (x != null)
			{
				return x.href;
			}
			else {return 'undefined';}
		},j);
		// var tempAnchors = await browserPage.$$('a');
		// var tempHref = await (tempAnchors[j]).attribute('href');
		console.log('finish');
		//check if the link is in the same domain as the initial address
		tempHref = tempHref.replace("#","");
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
	//console.log(page);
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

async function screenshots(listOfPages,dir,url)
{
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	await page.setViewport({width: 1920, height: 1080});
	for (var i=0;i<listOfPages.length;i++)
	{
		if (listOfPages[i].slice(-4) !== '.pdf')
		{
			pageName = listOfPages[i].replace(/\//g,'_');
			pageName = pageName.replace(/#/g,'');
			//console.log(pageName);
			await page.goto(url+listOfPages[i]);
			await page.screenshot({path: dir+'/images/'+pageName+'.png', fullPage: true});

			await page.goto('https://validator.w3.org/');
			await page.focus('#uri');
			await page.type(url+listOfPages[i]);
			await page.click('#validate-by-uri .submit');
			await page.waitForSelector('.details');
			await page.screenshot({path: dir+'/markupValidator/'+pageName+'.png', fullPage: true});
		}
	}
	await page.setViewport({width: 320, height: 568, isMobile: true});
	for (var i=0;i<listOfPages.length;i++)
	{
		if (listOfPages[i].slice(-4) !== '.pdf')
		{
			pageName = listOfPages[i].replace(/\//g,'_');
			pageName = pageName.replace(/#/g,'');
			//console.log(pageName);
			await page.goto(url+listOfPages[i]);
			await page.screenshot({path: dir+'/mobileImages/'+pageName+'.png', fullPage: true});
		}
	}
	browser.close();
}

async function createLighthouseReports(allPages,dir,url)
{
	for (var i=0;i<allPages.length;i++)
	{
		await launchChromeAndRunLighthouse(url+allPages[i], flags).then(results => {
			var pageName = allPages[i].replace(/\//g,'_');		
			pageName = pageName.replace(/#/g,'');
			fs.writeFile(dir+'/lighthouse/'+pageName+'_report.JSON', JSON.stringify(results), (err) => {
			  	if (err) throw err;
			  	//console.log('The file has been saved!');
			});
		});
	}
}

if((process.argv.indexOf("--url") != -1) && (process.argv.indexOf("--dir") != -1)){ //does our flag exist?
    var url = process.argv[process.argv.indexOf("--url") + 1]; //grab the next item
    var dir = process.argv[process.argv.indexOf("--dir") + 1]; //grab the next item
    getPagesInitial(url,dir).catch(console.error.bind(console))
}
else
{
	console.log("		**************************************************");
	console.log("		URL needs to be passed using the following syntax");
	console.log("		node audit.js --url <URL> --dir <Directory Name>");
	console.log("		**************************************************");
}
