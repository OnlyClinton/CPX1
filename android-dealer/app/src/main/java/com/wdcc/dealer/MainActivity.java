package com.wdcc.dealer;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER = 4101;
    private static final String[] CANDIDATES = new String[]{
            "https://dealer.wedontcarecars.com/dealer",
            "https://wdcc-v32-storefront-7bw9v7387-cpxagency.vercel.app/dealer",
            "https://wdcc-cpx-launch-cpxagency.vercel.app/dealer"
    };

    private WebView webView;
    private ProgressBar progress;
    private TextView status;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(2,6,11));
        getWindow().setNavigationBarColor(Color.rgb(2,6,11));
        buildUi();
        configureWebView();
        resolveDealerEndpoint();
    }

    private void buildUi() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(2,6,11));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(2,6,11));
        root.addView(webView, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        LinearLayout loading = new LinearLayout(this);
        loading.setOrientation(LinearLayout.VERTICAL);
        loading.setGravity(Gravity.CENTER);
        loading.setPadding(36,36,36,36);
        loading.setBackgroundColor(Color.rgb(2,6,11));

        TextView brand = new TextView(this);
        brand.setText("WDCC  DEALER");
        brand.setTextColor(Color.WHITE);
        brand.setTextSize(26);
        brand.setGravity(Gravity.CENTER);
        brand.setTypeface(null, android.graphics.Typeface.BOLD);
        loading.addView(brand);

        status = new TextView(this);
        status.setText("Connecting to Dealer Operations…");
        status.setTextColor(Color.rgb(170,184,198));
        status.setTextSize(14);
        status.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        sp.setMargins(0,18,0,18);
        loading.addView(status, sp);

        progress = new ProgressBar(this);
        loading.addView(progress);
        loading.setTag("loading");
        root.addView(loading, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString() + " WDCCDealerAndroid/1.0");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                if (scheme.equals("http") || scheme.equals("https")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                hideLoading();
                CookieManager.getInstance().flush();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int newProgress) {
                if (status != null && newProgress < 100) status.setText("Loading Dealer Operations… " + newProgress + "%");
            }

            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    Intent files = params.createIntent();
                    files.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    files.setType("image/*");

                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Images.Media.DISPLAY_NAME, "WDCC-" + System.currentTimeMillis() + ".jpg");
                    values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) values.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/WDCCDealer");
                    cameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);

                    Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    if (cameraUri != null) camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                    camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);

                    Intent chooser = Intent.createChooser(files, "Add vehicle photos");
                    if (camera.resolveActivity(getPackageManager()) != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
                    startActivityForResult(chooser, FILE_CHOOSER);
                    return true;
                } catch (Exception error) {
                    fileCallback = null;
                    return false;
                }
            }
        });
    }

    private void resolveDealerEndpoint() {
        new Thread(() -> {
            String chosen = null;
            for (String candidate : CANDIDATES) {
                if (isDealerPortal(candidate)) { chosen = candidate; break; }
            }
            final String target = chosen != null ? chosen : CANDIDATES[1];
            runOnUiThread(() -> {
                status.setText("Opening secure dealer portal…");
                webView.loadUrl(target);
            });
        }).start();
    }

    private boolean isDealerPortal(String url) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(6000);
            conn.setRequestProperty("User-Agent", "WDCCDealerAndroid-Probe/1.0");
            int code = conn.getResponseCode();
            if (code < 200 || code >= 400) return false;
            InputStream stream = conn.getInputStream();
            BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
            StringBuilder body = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null && body.length() < 140000) body.append(line);
            String html = body.toString().toLowerCase();
            boolean dealerMarker = html.contains("checking secure session") || html.contains("dealer sign in") || html.contains("dealer portal") || html.contains("dealer operations");
            boolean customerOnly = html.contains("see real inventory") && html.contains("call sean") && !html.contains("checking secure session");
            return dealerMarker && !customerOnly;
        } catch (Exception ignored) {
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void hideLoading() {
        View root = (View) webView.getParent();
        if (root instanceof FrameLayout) {
            FrameLayout frame = (FrameLayout) root;
            for (int i = frame.getChildCount() - 1; i >= 0; i--) {
                View child = frame.getChildAt(i);
                if ("loading".equals(child.getTag())) { frame.removeView(child); break; }
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER || fileCallback == null) return;
        List<Uri> result = new ArrayList<>();
        if (resultCode == RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                for (int i = 0; i < data.getClipData().getItemCount(); i++) result.add(data.getClipData().getItemAt(i).getUri());
            } else if (data != null && data.getData() != null) {
                result.add(data.getData());
            } else if (cameraUri != null) {
                result.add(cameraUri);
            }
        }
        fileCallback.onReceiveValue(result.isEmpty() ? null : result.toArray(new Uri[0]));
        fileCallback = null;
        cameraUri = null;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
