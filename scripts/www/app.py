from flask import Flask, render_template, send_from_directory

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/aliases")
def aliases():
    return render_template("aliases.html")


@app.route("/custom")
def custom():
    return render_template("custom.html")


@app.route("/DX_Pass")
def DX_Pass():
    return render_template("DX_Pass.html")


@app.route("/DX_Pass_custom")
def DX_Pass_custom():
    return render_template("DX_Pass_custom.html")


@app.route("/cookie_error")
def cookie_error():
    return render_template("cookie_error.html")


@app.route("/test")
def test():
    return render_template("test.html")


@app.errorhandler(404)
def page_not_found(e):
    return render_template("404.html"), 404


@app.route("/favicon.ico")
def favicon():
    return send_from_directory(
        "static", "favicon.ico", mimetype="image/vnd.microsoft.icon"
    )


if __name__ == "__main__":

    from gevent import pywsgi

    server = pywsgi.WSGIServer(("0.0.0.0", 2233), app)
    server.serve_forever()