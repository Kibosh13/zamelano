#!/usr/bin/env python3
"""Exercise the real PHP API in isolated temporary storage; no production calls."""
import base64
import copy
import hashlib
import http.cookiejar
import io
import json
import os
from pathlib import Path
import secrets
import socket
import struct
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT/'build/cms-local'

class Client:
    def __init__(self, port):
        self.base = 'http://127.0.0.1:'+str(port)+'/'
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
        self.csrf = None
    def call(self, action, body=None, csrf=True):
        headers = {'Origin':self.base.rstrip('/')}
        if body is not None:
            headers['Content-Type']='application/json'
            if csrf: headers['X-CSRF-Token']=self.csrf or ''
        request = urllib.request.Request(self.base+'admin/api.php?action='+action,data=None if body is None else json.dumps(body,ensure_ascii=False).encode(),headers=headers)
        try:
            with self.opener.open(request) as r: code=r.status; result=json.load(r)
        except urllib.error.HTTPError as r: code=r.code; result=json.load(r)
        if 'csrf' in result: self.csrf=result['csrf']
        return code,result
    def upload(self,name,data,mime):
        boundary='cms-'+secrets.token_hex(12)
        raw=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n').encode()+data+f'\r\n--{boundary}--\r\n'.encode()
        request=urllib.request.Request(self.base+'admin/api.php?action=upload',data=raw,headers={'Origin':self.base.rstrip('/'),'Content-Type':'multipart/form-data; boundary='+boundary,'X-CSRF-Token':self.csrf})
        try:
            with self.opener.open(request) as r:return r.status,json.load(r)
        except urllib.error.HTTPError as r:return r.code,json.load(r)
    def public(self):
        with self.opener.open(self.base+'cms.php') as r:return json.load(r)

def png():
    def chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!IIBBBBB',2,2,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\0'+b'\xff\0\0'*2+b'\0'+b'\xff\0\0'*2))+chunk(b'IEND',b'')

class Integration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(prefix='zamelano-cms-tests-'); cls.storage=Path(cls.temp.name)/'storage'; cls.storage.mkdir()
        cls.token=secrets.token_urlsafe(32); cls.password=secrets.token_urlsafe(28)
        (cls.storage/'owner-setup.json').write_text(json.dumps({'tokenHash':hashlib.sha256(cls.token.encode()).hexdigest(),'expiresAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(time.time()+3600))}))
        cls.servers=[]; cls.ports=[]
        for n in range(2):
            with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
            env={**os.environ,'ZAMELANO_DEV':'1','ZAMELANO_STORAGE':str(cls.storage)}
            process=subprocess.Popen(['php','-S','127.0.0.1:'+str(port),'-t',str(BUILD)],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            cls.servers.append(process);cls.ports.append(port)
            for _ in range(50):
                try:
                    with urllib.request.urlopen('http://127.0.0.1:'+str(port)+'/cms.php',timeout=.2):break
                except Exception:time.sleep(.05)
        cls.owner=Client(cls.ports[0]);cls.owner.call('session')
        code,result=cls.owner.call('setup',{'token':cls.token,'login':'local-owner','name':'Local fixture','password':cls.password})
        if code!=200:raise AssertionError(result)
    @classmethod
    def tearDownClass(cls):
        for p in cls.servers:p.terminate();p.wait(timeout=5)
        cls.temp.cleanup()
    def snapshot(self):
        code,data=self.owner.call('data');self.assertEqual(code,200);return data
    def save(self,payload):
        data=self.snapshot();code,result=self.owner.call('save',{'revision':data['revision'],'payload':payload,'label':'Automated local fixture'})
        self.assertEqual(code,200,result);return result['revision']
    def test_01_access_and_csrf(self):
        guest=Client(self.ports[0]);self.assertEqual(guest.call('data')[0],401)
        self.assertEqual(guest.call('login',{'login':'local-owner','password':self.password},csrf=False)[0],403)
        self.assertEqual(self.owner.call('save',{'revision':1,'payload':{}},csrf=False)[0],403)
        self.assertEqual(self.owner.call('setup',{'token':self.token,'login':'other','password':self.password})[0],409)
    def test_02_product_publish_edit_trash_and_shared_domains(self):
        state=self.snapshot();payload=state['draft'];p=copy.deepcopy(payload['catalog']['products'][0]);p.update({'id':'local-product','concept':False,'status':'published','name':{'ru':'Fixture product','en':'Fixture product'},'price':3190,'stock':7,'sizes':['S','M'],'colors':['Ivory']});payload['catalog']['products'].append(p)
        revision=self.save(payload);self.assertNotIn('local-product',[x['id'] for x in self.owner.public()['catalog']['products']])
        with self.owner.opener.open(self.owner.base+'cms.php?preview=1') as r:preview=json.load(r)
        self.assertIn('local-product',[x['id'] for x in preview['catalog']['products']])
        self.assertEqual(self.owner.call('publish',{'revision':revision})[0],200)
        mirror=Client(self.ports[1]);self.assertEqual(next(x for x in mirror.public()['catalog']['products'] if x['id']=='local-product')['stock'],7)
        payload=self.snapshot()['draft'];next(x for x in payload['catalog']['products'] if x['id']=='local-product')['price']=2490
        revision=self.save(payload);self.owner.call('publish',{'revision':revision});self.assertEqual(next(x for x in mirror.public()['catalog']['products'] if x['id']=='local-product')['price'],2490)
        payload=self.snapshot()['draft'];next(x for x in payload['catalog']['products'] if x['id']=='local-product')['status']='trash';revision=self.save(payload);self.owner.call('publish',{'revision':revision});self.assertNotIn('local-product',[x['id'] for x in mirror.public()['catalog']['products']])
        self.assertTrue(any(x['id']=='local-product' for x in self.snapshot()['draft']['catalog']['products']))
    def test_03_validation_and_conflicts(self):
        state=self.snapshot();payload=copy.deepcopy(state['draft']);payload['content']['settings']['contacts']['telegram']='javascript:alert(1)'
        self.assertEqual(self.owner.call('save',{'revision':state['revision'],'payload':payload})[0],400)
        self.assertEqual(self.owner.call('save',{'revision':state['revision']-1,'payload':state['draft']})[0],409)
        self.assertEqual(self.snapshot()['revision'],state['revision'])
    def test_04_media_upload_access_and_executable_rejection(self):
        code,result=self.owner.upload('test.php',b'<?php echo 1;?>','application/x-httpd-php');self.assertEqual(code,400)
        code,result=self.owner.upload('test.svg',b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>','image/svg+xml');self.assertEqual(code,400)
        code,result=self.owner.upload('fixture.png',png(),'image/png');self.assertEqual(code,200,result);file=result['file']
        guest=Client(self.ports[0])
        with self.assertRaises(urllib.error.HTTPError) as err:guest.opener.open(guest.base+file['url'])
        self.assertEqual(err.exception.code,404)
        payload=self.snapshot()['draft'];payload['content']['images']['hero']['src']=file['url'];revision=self.save(payload);self.owner.call('publish',{'revision':revision})
        with guest.opener.open(guest.base+file['url']) as r:self.assertEqual(r.headers['Content-Type'],'image/png');self.assertTrue(r.read().startswith(b'\x89PNG'))
        self.assertEqual(self.owner.call('media-trash',{'id':file['id']})[0],409)
    def test_05_backups_restore_and_no_credentials_in_exports(self):
        state=self.snapshot();self.assertTrue(state['history']);code,backup=self.owner.call('backup');self.assertEqual(code,200)
        serialized=json.dumps(backup);self.assertNotIn('passwordHash',serialized);self.assertNotIn(self.password,serialized);self.assertNotIn('tokenHash',serialized)
        before=self.owner.public()['revision'];row=state['history'][-1];code,result=self.owner.call('restore',{'revision':state['revision'],'id':row['id']});self.assertEqual(code,200,result);self.assertEqual(self.owner.public()['revision'],before)
    def test_06_password_rotation_invalidates_other_sessions(self):
        second=Client(self.ports[1]);second.call('session');self.assertEqual(second.call('login',{'login':'local-owner','password':self.password})[0],200)
        new=secrets.token_urlsafe(28);self.assertEqual(self.owner.call('password',{'currentPassword':self.password,'newPassword':new})[0],200)
        self.assertEqual(second.call('data')[0],401)
        second.call('session');self.assertEqual(second.call('login',{'login':'local-owner','password':new})[0],200)
    def test_07_rate_limit_and_direct_template_denial(self):
        guest=Client(self.ports[0]);guest.call('session')
        results=[guest.call('login',{'login':'nobody','password':'invalid-local-fixture'})[0] for _ in range(9)]
        self.assertEqual(results[-1],429)
        for path in ['admin/core.php','admin/admin.view.php','index.view.php','documents.view.php']:
            with self.assertRaises(urllib.error.HTTPError) as err:guest.opener.open(guest.base+path)
            self.assertEqual(err.exception.code,404,path)

if __name__=='__main__':unittest.main(verbosity=2)
