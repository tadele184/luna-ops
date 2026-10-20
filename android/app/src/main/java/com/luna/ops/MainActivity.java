package com.luna.ops;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

/**
 * LUNA Ops for Android: the same screens as the Telegram app (bundled in assets/index.html), talking to the
 * LUNA Ops server on Tadele's Mac. Entries are kept on the phone until the server confirms them.
 * (c) 2026 Tadele B. All Rights Reserved. Developed by Tadele B. Contact: tadelebek@gmail.com
 */
public class MainActivity extends Activity {
    private static final String PREFS = "luna_ops";
    private WebView web;
    private String pendingLink = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setTextZoom(100);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openOutside(request.getUrl());
            }
        });
        web.addJavascriptInterface(new Bridge(), "LunaNative");
        pendingLink = linkOf(getIntent());
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    private boolean openOutside(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        if (scheme.equals("file")) {
            return false;
        }
        if (scheme.equals("lunaops")) {
            deliverLink(uri.toString());
            return true;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception e) {
            Toast.makeText(this, "Cannot open the link", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    private static String linkOf(Intent intent) {
        if (intent != null && intent.getData() != null && "lunaops".equals(intent.getData().getScheme())) {
            return intent.getData().toString();
        }
        return "";
    }

    private void deliverLink(String link) {
        web.evaluateJavascript("window.__lunaLink && window.__lunaLink(" + JSONObject.quote(link) + ")", null);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String link = linkOf(intent);
        if (!link.isEmpty()) {
            deliverLink(link);
        }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.__lunaBack && window.__lunaBack()) ? 'yes' : 'no'", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                if (value == null || !value.contains("yes")) {
                    finish();
                }
            }
        });
    }

    /** Called from the page as window.LunaNative.* */
    private class Bridge {
        private SharedPreferences prefs() {
            return getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        }

        @JavascriptInterface
        public String get(String key) {
            return prefs().getString(key, null);
        }

        @JavascriptInterface
        public void set(String key, String value) {
            prefs().edit().putString(key, value).commit();
        }

        @JavascriptInterface
        public String takeLink() {
            String l = pendingLink;
            pendingLink = "";
            return l;
        }

        @JavascriptInterface
        public String deviceName() {
            String m = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER;
            String n = Build.MODEL == null ? "Android" : Build.MODEL;
            String name = n.toLowerCase().startsWith(m.toLowerCase()) ? n : (m + " " + n);
            return name.trim();
        }

        @JavascriptInterface
        public String appVersion() {
            return "10.0";
        }

        @JavascriptInterface
        public void vibrate() {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null) {
                    return;
                }
                if (Build.VERSION.SDK_INT >= 26) {
                    v.vibrate(VibrationEffect.createOneShot(40, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(40);
                }
            } catch (Exception ignored) {
                // no vibration on this phone
            }
        }

        @JavascriptInterface
        public void download(String url, String fileName, String token) {
            try {
                DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
                r.addRequestHeader("Authorization", "Bearer " + token);
                r.addRequestHeader("ngrok-skip-browser-warning", "1");
                r.setTitle(fileName);
                r.setMimeType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                dm.enqueue(r);
            } catch (Exception e) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(MainActivity.this, "Download failed", Toast.LENGTH_SHORT).show();
                    }
                });
            }
        }
    }
}
