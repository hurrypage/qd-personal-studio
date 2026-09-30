import os
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('FUND_TOUCH_TEST_URL','http://127.0.0.1:8878/'));page.locator('#accessPassword').fill('1234');page.locator('.access-submit').click();page.locator('.app-shell').wait_for(state='visible')
 card=page.locator('#list .card').first;code=card.get_attribute('data-code');card.locator('.f-head').click()
 assert 'expanded' in card.get_attribute('class')
 assert card.get_attribute('draggable')=='false'
 assert card.get_attribute('ontouchstart') is None
 page.wait_for_function("document.querySelector('#list .expanded .cmp-index-line')",timeout=60000)
 page.evaluate("document.querySelector('#list .expanded .hm-chart').scrollIntoView({block:'center',behavior:'instant'})")
 page.screenshot(path='../expanded-fund-mobile.png')
 before=page.evaluate('scrollY')
 page.evaluate("window.touchWasPrevented=false;document.addEventListener('touchmove',e=>{setTimeout(()=>window.touchWasPrevented=e.defaultPrevented,0)})")
 cdp=page.context.new_cdp_session(page)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':190,'y':580}]})
 page.wait_for_timeout(600)
 for y in [500,420,340,260]:
  cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':190,'y':y}]});page.wait_for_timeout(40)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(350)
 assert not page.evaluate('touchWasPrevented')
 assert page.evaluate('scrollY')>before+50
 card.locator('.fund-close-detail').click();assert card.locator('.detail-grid').count()==0
 page.wait_for_function("document.querySelector('#list .card').getBoundingClientRect().top >= 45")
 card.locator('.f-head').press('Enter');assert card.locator('.detail-grid').count()==1
 card.locator('.f-head').press('Enter');assert card.locator('.detail-grid').count()==0
 page.locator('.ni[data-v="mkt"]').click();pcard=page.locator('#personalList .card[data-code="163415"]');pcard.locator('.f-head').click();pcard.locator('.fund-close-detail').click();assert pcard.locator('.detail-grid').count()==0
 page.locator('.ni[data-v="etf"]').click();etf=page.locator('#etf .etf-item').first;etf.locator('.etf-chart-toggle').click();assert 'expanded' in etf.get_attribute('class');etf.locator('.fund-close-detail').click();assert etf.locator('.etf-chart-panel').count()==0
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 desktop=b.new_page(viewport={'width':1440,'height':1000});desktop.goto(os.environ.get('FUND_TOUCH_TEST_URL','http://127.0.0.1:8878/'));desktop.locator('#accessPassword').fill('1234');desktop.locator('.access-submit').click();assert desktop.locator('#list .card').first.get_attribute('draggable')=='true'
 print('Slow long-press swipe stays native and scrolls; general/personal/ETF collapse, viewport return, keyboard, mobile width and desktop drag passed.')
 b.close()
