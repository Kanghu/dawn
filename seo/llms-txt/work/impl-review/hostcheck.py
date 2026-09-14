import subprocess, time, os, sys
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
out=os.path.join(os.path.dirname(os.path.abspath(__file__)),'live')
urls=[('bare-https','https://alessandrodesign.ro/llms.txt'),
      ('www-http','http://www.alessandrodesign.ro/llms.txt'),
      ('myshopify','https://d8cgqq-8s.myshopify.com/llms.txt'),
      ('bare-http','http://alessandrodesign.ro/llms.txt'),
      ('eu-sitemap','https://www.alessandrodesign.eu/sitemap.xml')]
for i,(k,u) in enumerate(urls):
    if i: time.sleep(3)
    h=os.path.join(out,k+'.headers.txt'); b=os.path.join(out,k+'.body')
    r=subprocess.run(['curl','-s','-A',UA,'-H','Accept: text/plain,text/markdown,*/*','--compressed','-D',h,'-o',b,'-w','%{http_code} %{redirect_url} %{size_download}',u],capture_output=True,text=True)
    print(k,u,'->',r.stdout)
