"""Loopback responses for owned native status tests; no external inference."""
import json
import threading
import time
from ipaddress import IPv4Address
from http.server import HTTPServer, BaseHTTPRequestHandler

class Fixture:
    def __init__(self, root):
        self.root=root
        self.stop=threading.Event()
        self.permission_sent=False
        self.permission_rejected=False
        self.requests=0
        owner=self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_GET(self):
                body=json.dumps({'object':'list','data':[{'id':'pc-fixture','object':'model'}]}).encode()
                self.send_response(200);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
            def do_POST(self):
                self.connection.settimeout(2)
                size=int(self.headers.get('Content-Length','0'))
                if not 0<=size<=1024*1024:self.send_error(413);return
                request=json.loads(self.rfile.read(size));owner.requests+=1
                messages=request.get('messages',[])
                last=next((json.dumps(m.get('content')) for m in reversed(messages) if m.get('role')=='user'),'')
                results=json.dumps([m.get('content') for m in messages if m.get('role')=='tool']).lower()
                owner.permission_rejected|='denied' in results or 'reject' in results
                base={'id':'fixture','object':'chat.completion.chunk','created':0,'model':'pc-fixture'}
                delta={'role':'assistant','content':'fixture complete'};finish='stop'
                if 'fixture-permission' in last and not owner.permission_sent:
                    tools=[t.get('function',{}) for t in request.get('tools',[])]
                    tool=next((t for t in tools if t.get('name') in ['shell','bash'] and 'command' in t.get('parameters',{}).get('properties',{})),None)
                    if tool:
                        owner.permission_sent=True
                        # Rejected by the fixture's permission.reply; never approved/executed.
                        delta={'role':'assistant','tool_calls':[{'index':0,'id':'fixture_permission','type':'function','function':{'name':tool['name'],'arguments':json.dumps({'command':'printf fixture','description':'read-only isolated fixture, reject permission'})}}]};finish='tool_calls'
                chunks=[{**base,'choices':[{'index':0,'delta':delta,'finish_reason':None}]},{**base,'choices':[{'index':0,'delta':{},'finish_reason':finish}]}]
                payload=(''.join('data: '+json.dumps(c)+'\n\n' for c in chunks)+'data: [DONE]\n\n').encode()
                self.send_response(200);self.send_header('Content-Type','text/event-stream');self.send_header('Connection','close');self.end_headers()
                if 'fixture-busy' in last and not (owner.root/'release-busy').exists():
                    end=time.monotonic()+25
                    while time.monotonic()<end and not (owner.root/'release-busy').exists() and not owner.stop.wait(.05):pass
                if not owner.stop.wait(.15):self.wfile.write(payload);self.wfile.flush()
                self.close_connection=True
        class Server(HTTPServer):
            def handle_error(self,*args):pass
        self.server=Server((str(IPv4Address(0x7f000001)),0),Handler);self.port=self.server.server_port;self.server.timeout=.1;self.thread=None
    def start(self):
        def serve():
            while not self.stop.is_set():self.server.handle_request()
        self.thread=threading.Thread(target=serve,daemon=True);self.thread.start()
    def close(self):
        self.stop.set()
        if self.thread:self.thread.join(3)
        self.server.server_close()
        return self.server.fileno()==-1 and (self.thread is None or not self.thread.is_alive())
