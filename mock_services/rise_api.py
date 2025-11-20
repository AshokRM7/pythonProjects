from fastapi import FastAPI
app=FastAPI()
@app.get('/tickets')
def tickets():return [{'id':'IAM-1','desc':'sample'}]