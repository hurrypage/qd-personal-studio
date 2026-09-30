"""Refresh source-backed public fund metadata and disclosed holdings for the personal list."""
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
NOW = datetime.now(ZoneInfo('Asia/Shanghai'))
HEADERS = {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://fundf10.eastmoney.com/'}


def read_url(url):
    response = requests.get(url, headers=HEADERS, timeout=25)
    response.raise_for_status()
    response.encoding = 'utf-8'
    return response.text


def positions(code, kind):
    url = f'https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type={kind}&code={code}&topline=10&year=&month=&rt={time.time()}'
    text = read_url(url)
    match = re.search(r'content:\s*("(?:\\.|[^"\\])*")', text)
    if not match:
        raise ValueError('No holdings response')
    soup = BeautifulSoup(json.loads(match.group(1)), 'html.parser')
    box = soup.select_one('.boxitem')
    if not box or not box.select_one('tbody'):
        return [], ''
    date = re.search(r'截止至：\s*(\d{4}-\d{2}-\d{2})', box.get_text(' ', strip=True))
    rows = []
    for row in box.select('tbody tr')[:10]:
        cells = row.select('td')
        if len(cells) < 4:
            continue
        weight = next((c.get_text(strip=True) for c in cells[3:] if re.fullmatch(r'[\d.]+%', c.get_text(strip=True))), None)
        if not weight:
            continue
        stock_code, name = [c.get_text(strip=True) for c in cells[1:3]]
        market_link = cells[1].select_one('a[href]')
        market = re.search(r'/r/(\d+)\.', market_link.get('href', '')) if market_link else None
        texch = {'0': '2', '1': '1', '116': '5', '105': '7', '106': '7', '107': '7'}.get(market.group(1), '') if market else ''
        if not texch and re.fullmatch(r'[A-Z][A-Z.]*', stock_code):
            texch = '7'
        rows.append({'code': stock_code, 'name': name, 'weight': float(weight[:-1]), 'kind': 'bond' if kind == 'zqcc' else 'stock', **({'texch': texch} if texch else {})})
    return rows, date.group(1) if date else ''


def refresh(code, meta, previous):
    old = previous.get(code, {})
    record = dict(old, code=code, name=meta[2], ftype=meta[3])
    try:
        stocks, date = positions(code, 'jjcc')
        bonds, bond_date = (positions(code, 'zqcc') if '债' in meta[3] else ([], ''))
        if stocks or bonds:
            record.update(holdings=stocks + bonds, reportDate=date or bond_date, holdingsCheckedAt=NOW.isoformat())
    except Exception as error:
        print(f'{code}: holdings unavailable ({type(error).__name__}), retaining last verified snapshot')
    try:
        text = read_url(f'https://fund.eastmoney.com/pingzhongdata/{code}.js?v={NOW:%Y%m%d}')
        cum_match = re.search(r'var\s+Data_ACWorthTrend\s*=\s*(\[.*?\]);', text)
        unit_match = re.search(r'var\s+Data_netWorthTrend\s*=\s*(\[.*?\]);', text)
        if not cum_match or not unit_match:
            raise ValueError('No NAV series')
        cum = json.loads(cum_match.group(1))
        units = json.loads(unit_match.group(1))
        cutoff = datetime(NOW.year, 1, 1, tzinfo=ZoneInfo('Asia/Shanghai')).timestamp() * 1000
        base = next((point[1] for point in reversed(cum) if point[0] < cutoff), None)
        last = cum[-1]
        nav_date = datetime.fromtimestamp(last[0] / 1000, ZoneInfo('Asia/Shanghai')).strftime('%Y-%m-%d')
        ytd = (last[1] / base - 1) * 100 if base and last[0] >= cutoff else None
        record.update(nav=units[-1]['y'], navDate=nav_date, ytd=ytd, ytdDate=nav_date, checkedAt=NOW.isoformat())
    except Exception as error:
        print(f'{code}: NAV unavailable ({type(error).__name__}), retaining last verified snapshot')
    return record


def main():
    codes = json.loads((ROOT / 'personal-funds.json').read_text(encoding='utf-8'))
    registry_text = read_url('https://fund.eastmoney.com/js/fundcode_search.js')
    registry = {row[0]: row for row in json.loads(registry_text[registry_text.index('['):registry_text.rindex(']') + 1])}
    target = ROOT / 'personal-data.js'
    previous = {}
    if target.exists():
        data = json.loads(target.read_text(encoding='utf-8').split('=', 1)[1].strip().rstrip(';'))
        previous = {record['code']: record for record in data['funds']}
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(lambda code: refresh(code, registry[code], previous), codes))
    target.write_text('window.PERSONAL_DATA = ' + json.dumps({'updatedAt': NOW.isoformat(), 'funds': rows}, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(f'Updated {len(rows)} funds; {sum(bool(row.get("holdings")) for row in rows)} have disclosed holdings.')


if __name__ == '__main__':
    main()
