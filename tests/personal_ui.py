"""Verify personal list membership, exact share classes, real charts and responsive layout."""
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get('PERSONAL_TEST_URL', 'http://127.0.0.1:8878/')
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL, wait_until='domcontentloaded')
    assert page.locator('.app-shell').count() == 0
    page.locator('#accessPassword').fill('1234')
    page.locator('.access-submit').click()
    page.locator('.app-shell').wait_for(state='visible')
    page.locator('.ni[data-v="mkt"]').click()
    assert page.locator('#personalList > .card').count() == 21
    for code in ['013403', '008971', '016858']:
        assert page.locator(f'#personalList .card[data-code="{code}"]').count() == 1
    page.locator('#personalSearch').fill('纳斯达克')
    assert page.locator('#personalList > .card').count() == 6
    page.locator('#personalSearch').fill('')
    page.select_option('#personalSort', 'ytd')
    codes = page.locator('#personalList > .card').evaluate_all('(cards) => cards.map(card=>card.dataset.code)')
    values = page.evaluate('(codes) => codes.map(code=>funds.find(f=>f.code===code).ytd)', codes)
    known = [value for value in values if value is not None]
    assert known == sorted(known, reverse=True)
    page.select_option('#personalSort', 'default')
    card = page.locator('#personalList .card[data-code="163415"]')
    card.locator('.f-head').click()
    assert card.locator('.hold tr').count() == 11
    page.wait_for_function("document.querySelector('#personalList .card[data-code=\"163415\"] .cmp-index-line')", timeout=60000)
    assert card.locator('.cmp-fund-line').count() == 1
    card.locator('.hm-tab').first.click()
    assert card.locator('.hm-tab.on').inner_text() == '近一周'
    page.wait_for_function("estimate(funds.find(f=>f.code==='163415')).live !== null", timeout=60000)
    assert page.evaluate("quoteCodeOf({code:'230413',kind:'bond'})") is None
    assert page.evaluate("estimate(funds.find(f=>f.code==='004388')).live") is None
    page.on('dialog', lambda dialog: dialog.accept())
    page.locator('#personalList .card[data-code="019441"] .f-x').click()
    assert page.locator('#personalList > .card').count() == 20
    page.locator('.ni[data-v="home"]').click()
    assert page.locator('#list .card[data-code="019441"]').count() == 1
    page.reload()
    page.locator('.app-shell').wait_for(state='visible')
    page.locator('.ni[data-v="mkt"]').click()
    assert page.locator('#personalList > .card').count() == 20
    for code in ['013403', '008971']:
        assert page.locator(f'#personalList .card[data-code="{code}"]').count() == 1
    page.get_by_role('button', name='恢复截图清单').click()
    assert page.locator('#personalList > .card').count() == 21
    page.locator('.ni[data-v="home"]').click()
    page.evaluate("searchResults=[{code:'001410',name:funds.find(f=>f.code==='001410').name}];addFund(0)")
    assert page.locator('#list .card[data-code="001410"]').count() == 1
    page.evaluate("delFund('001410','信澳新能源产业股票A')")
    assert page.locator('#list .card[data-code="001410"]').count() == 0
    page.locator('.ni[data-v="mkt"]').click()
    assert page.locator('#personalList .card[data-code="001410"]').count() == 1
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    browser.close()
    print('Personal list, exact A/C classes, search, sort, holdings, live estimate, HS300 charts, membership persistence and mobile layout passed.')
