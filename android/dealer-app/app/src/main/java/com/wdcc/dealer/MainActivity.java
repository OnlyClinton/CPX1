package com.wdcc.dealer;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.core.content.FileProvider;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4013;
    private static final String HOME_URL = "https://dealer.wedontcarecars.com/dealer";
    private static final String[] DEALER_ENDPOINTS = new String[]{
            HOME_URL
    };

    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final Set<String> attemptedEndpoints = new LinkedHashSet<>();
    private WebView webView;
    private LinearLayout loadingOverlay;
    private LinearLayout errorOverlay;
    private TextView loadingStatus;
    private TextView errorMessage;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private boolean firstDealerPageVerified;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(2, 7, 13));
        getWindow().setNavigationBarColor(Color.rgb(2, 7, 13));
        buildInterface();
        configureWebView();

        if (savedInstanceState == null) {
            Uri deepLink = getIntent() == null ? null : getIntent().getData();
            if (deepLink != null && isTrustedHost(deepLink.getHost())) {
                loadPortal(deepLink.toString());
            } else {
                resolveAndLoadPortal();
            }
        } else {
            if (webView.restoreState(savedInstanceState) == null) resolveAndLoadPortal();
            else hideStatusPanels();
        }
    }

    private void buildInterface() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(2, 7, 13));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(244, 246, 248));
        root.addView(webView, matchParent());

        loadingOverlay = buildStatusPanel(false);
        loadingOverlay.setTag("loading");
        loadingStatus = loadingOverlay.findViewWithTag("message");
        progressBar = loadingOverlay.findViewWithTag("progress");
        root.addView(loadingOverlay, matchParent());

        errorOverlay = buildStatusPanel(true);
        errorOverlay.setTag("error");
        errorMessage = errorOverlay.findViewWithTag("message");
        errorOverlay.setVisibility(View.GONE);
        root.addView(errorOverlay, matchParent());

        setContentView(root);
    }

    private LinearLayout buildStatusPanel(boolean error) {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(dp(34), dp(40), dp(34), dp(40));
        panel.setBackgroundColor(Color.rgb(2, 7, 13));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.wdcc_logo);
        logo.setAdjustViewBounds(true);
        panel.addView(logo, new LinearLayout.LayoutParams(dp(210), dp(170)));

        TextView title = new TextView(this);
        title.setText(error ? "DEALER PORTAL OFFLINE" : "WDCC · DEALER PORTAL");
        title.setTextColor(Color.WHITE);
        title.setTextSize(error ? 18 : 22);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        titleParams.setMargins(0, dp(8), 0, dp(7));
        panel.addView(title, titleParams);

        TextView subtitle = new TextView(this);
        subtitle.setText(error ? "Your work is safe. Reconnect and try again." : "INVENTORY OPERATIONS");
        subtitle.setTextColor(error ? Color.rgb(174, 189, 201) : Color.rgb(103, 127, 146));
        subtitle.setTextSize(error ? 14 : 11);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setLetterSpacing(error ? 0f : .14f);
        panel.addView(subtitle, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView message = new TextView(this);
        message.setTag("message");
        message.setText(error ? "The secure dealer service could not be reached." : "Connecting securely…");
        message.setTextColor(error ? Color.rgb(255, 171, 179) : Color.rgb(174, 189, 201));
        message.setTextSize(13);
        message.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        messageParams.setMargins(0, dp(20), 0, dp(18));
        panel.addView(message, messageParams);

        if (!error) {
            ProgressBar progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
            progress.setTag("progress");
            progress.setMax(100);
            progress.setProgress(12);
            progress.setIndeterminate(false);
            progress.getProgressDrawable().setTint(Color.rgb(239, 35, 60));
            panel.addView(progress, new LinearLayout.LayoutParams(dp(240), dp(5)));
        } else {
            Button retry = actionButton("RETRY CONNECTION", Color.rgb(239, 35, 60));
            retry.setOnClickListener(v -> resolveAndLoadPortal());
            LinearLayout.LayoutParams retryParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52));
            retryParams.setMargins(0, dp(8), 0, dp(10));
            panel.addView(retry, retryParams);

            Button call = actionButton("CALL SEAN · (813) 516-4752", Color.rgb(12, 27, 40));
            call.setOnClickListener(v -> openExternal(Uri.parse("tel:18135164752")));
            panel.addView(call, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)));
        }
        return panel;
    }

    private Button actionButton(String label, int color) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.WHITE);
        button.setTextSize(12);
        button.setTypeface(null, android.graphics.Typeface.BOLD);
        button.setAllCaps(false);
        GradientDrawable background = new GradientDrawable();
        background.setColor(color);
        background.setCornerRadius(dp(8));
        background.setStroke(dp(1), color == Color.rgb(239, 35, 60) ? color : Color.rgb(46, 69, 88));
        button.setBackground(background);
        return button;
    }

    private FrameLayout.LayoutParams matchParent() {
        return new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @SuppressWarnings("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setGeolocationEnabled(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setUserAgentString(settings.getUserAgentString() + " WDCCDealerAndroid/3.0");

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = lower(uri.getScheme());
                if ((scheme.equals("https") || scheme.equals("http")) && isTrustedHost(uri.getHost())) return false;
                if (scheme.equals("tel") || scheme.equals("sms") || scheme.equals("mailto")) {
                    openExternal(uri);
                    return true;
                }
                if (scheme.equals("https") || scheme.equals("http")) {
                    openExternal(uri);
                    return true;
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (!firstDealerPageVerified) showLoading("Opening secure dealer workspace…");
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                CookieManager.getInstance().flush();
                verifyRenderedPortal(url);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError("Connection failed. Check your signal and retry.");
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) {
                    showError("Dealer service returned error " + response.getStatusCode() + ". Retry in a moment.");
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                showError("Secure connection validation failed. Nothing was sent.");
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                MainActivity.this.recreate();
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (progressBar != null) progressBar.setProgress(Math.max(8, newProgress));
                if (loadingStatus != null && loadingOverlay.getVisibility() == View.VISIBLE) {
                    loadingStatus.setText(newProgress < 100 ? "Loading Dealer Operations… " + newProgress + "%" : "Verifying dealer workspace…");
                }
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> newCallback, FileChooserParams params) {
                return openVehiclePhotoChooser(newCallback);
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            Uri uri = Uri.parse(url);
            if (isTrustedHost(uri.getHost())) openExternal(uri);
        });
    }

    private boolean openVehiclePhotoChooser(ValueCallback<Uri[]> newCallback) {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        fileCallback = newCallback;

        Intent gallery = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        gallery.addCategory(Intent.CATEGORY_OPENABLE);
        gallery.setType("image/*");
        gallery.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        gallery.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/jpeg", "image/png", "image/webp", "image/avif"});

        List<Intent> initial = new ArrayList<>();
        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camera.resolveActivity(getPackageManager()) != null) {
            try {
                File image = File.createTempFile("wdcc-vehicle-", ".jpg", getExternalFilesDir(Environment.DIRECTORY_PICTURES));
                cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", image);
                camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                camera.setClipData(ClipData.newRawUri("WDCC vehicle photo", cameraUri));
                initial.add(camera);
            } catch (IOException ignored) {
                cameraUri = null;
            }
        }

        Intent chooser = Intent.createChooser(gallery, "Add vehicle photos");
        if (!initial.isEmpty()) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, initial.toArray(new Intent[0]));
        try {
            startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
            return true;
        } catch (Exception error) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
            return false;
        }
    }

    private void resolveAndLoadPortal() {
        attemptedEndpoints.clear();
        firstDealerPageVerified = false;
        showLoading("Finding the secure dealer service…");
        networkExecutor.execute(() -> {
            String saved = getPreferences(MODE_PRIVATE).getString("last_dealer_endpoint", "");
            LinkedHashSet<String> ordered = new LinkedHashSet<>();
            if (!saved.isEmpty()) ordered.add(saved);
            for (String endpoint : DEALER_ENDPOINTS) ordered.add(endpoint);

            String selected = HOME_URL;
            for (String endpoint : ordered) {
                attemptedEndpoints.add(endpoint);
                runOnUiThread(() -> setLoadingMessage("Checking dealer service…"));
                if (isRealDealerPortal(endpoint)) {
                    selected = endpoint;
                    break;
                }
            }
            String resolved = selected;
            runOnUiThread(() -> loadPortal(resolved));
        });
    }

    private void loadPortal(String url) {
        showLoading("Opening secure dealer workspace…");
        webView.loadUrl(url);
    }

    private boolean isRealDealerPortal(String endpoint) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(endpoint).openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(6500);
            connection.setReadTimeout(7500);
            connection.setRequestProperty("User-Agent", "WDCCDealerAndroid-Probe/3.0");
            connection.setRequestProperty("Accept", "text/html,application/xhtml+xml");
            int code = connection.getResponseCode();
            if (code < 200 || code >= 400 || !isTrustedHost(connection.getURL().getHost())) return false;
            BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder body = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null && body.length() < 220000) body.append(line);
            String html = body.toString().toLowerCase();
            boolean dealerMarker = html.contains("checking secure dealer session")
                    || html.contains("checking secure session")
                    || html.contains("dealer sign in")
                    || html.contains("dealer portal")
                    || html.contains("dealer operations")
                    || html.contains("sales command");
            boolean customerOnly = html.contains("see real inventory")
                    && (html.contains("call sean") || html.contains("text sean"))
                    && !dealerMarker;
            return dealerMarker && !customerOnly;
        } catch (Exception ignored) {
            return false;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void verifyRenderedPortal(String url) {
        if (firstDealerPageVerified) {
            hideStatusPanels();
            return;
        }
        String script = "(function(){var t=((document.body&&document.body.innerText)||'').toLowerCase();"
                + "var d=t.includes('dealer sign in')||t.includes('dealer portal')||t.includes('dealer operations')||t.includes('sales command')||t.includes('checking secure session');"
                + "var c=t.includes('see real inventory')&&(t.includes('call sean')||t.includes('text sean'));"
                + "return d?'dealer':(c?'customer':'unknown');})()";
        webView.evaluateJavascript(script, value -> {
            if (value != null && value.contains("dealer")) {
                firstDealerPageVerified = true;
                getPreferences(MODE_PRIVATE).edit().putString("last_dealer_endpoint", rootDealerUrl(url)).apply();
                hideStatusPanels();
            } else {
                tryNextEndpoint();
            }
        });
    }

    private void tryNextEndpoint() {
        for (String endpoint : DEALER_ENDPOINTS) {
            if (!attemptedEndpoints.contains(endpoint)) {
                attemptedEndpoints.add(endpoint);
                loadPortal(endpoint);
                return;
            }
        }
        showError("The dealer address is routing to the public storefront. No dealer data was shown.");
    }

    private String rootDealerUrl(String url) {
        try {
            Uri uri = Uri.parse(url);
            if (isTrustedHost(uri.getHost())) return uri.buildUpon().path("/dealer").query(null).fragment(null).build().toString();
        } catch (Exception ignored) { }
        return HOME_URL;
    }

    private void showLoading(String message) {
        errorOverlay.setVisibility(View.GONE);
        loadingOverlay.setVisibility(View.VISIBLE);
        setLoadingMessage(message);
        if (progressBar != null) progressBar.setProgress(12);
    }

    private void setLoadingMessage(String message) {
        if (loadingStatus != null) loadingStatus.setText(message);
    }

    private void showError(String message) {
        loadingOverlay.setVisibility(View.GONE);
        errorMessage.setText(message);
        errorOverlay.setVisibility(View.VISIBLE);
    }

    private void hideStatusPanels() {
        loadingOverlay.setVisibility(View.GONE);
        errorOverlay.setVisibility(View.GONE);
    }

    private boolean isTrustedHost(String hostValue) {
        String host = lower(hostValue);
        return host.equals("dealer.wedontcarecars.com")
                || host.endsWith(".vercel-storage.com")
                || host.endsWith(".blob.vercel-storage.com")
                || host.endsWith(".public.blob.vercel-storage.com");
    }

    private String lower(String value) {
        return value == null ? "" : value.trim().toLowerCase(java.util.Locale.US);
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception ignored) { }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileCallback == null) return;
        List<Uri> selected = new ArrayList<>();
        if (resultCode == RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                ClipData clip = data.getClipData();
                for (int i = 0; i < clip.getItemCount(); i++) selected.add(clip.getItemAt(i).getUri());
            } else if (data != null && data.getData() != null) {
                selected.add(data.getData());
            } else if (cameraUri != null) {
                selected.add(cameraUri);
            }
        }
        fileCallback.onReceiveValue(selected.isEmpty() ? null : selected.toArray(new Uri[0]));
        fileCallback = null;
        cameraUri = null;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        Uri uri = intent == null ? null : intent.getData();
        if (uri != null && isTrustedHost(uri.getHost())) loadPortal(uri.toString());
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    public void onBackPressed() {
        if (errorOverlay.getVisibility() == View.VISIBLE) {
            hideStatusPanels();
        } else if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        fileCallback = null;
        networkExecutor.shutdownNow();
        if (webView != null) {
            webView.stopLoading();
            webView.clearHistory();
            webView.removeAllViews();
            webView.destroy();
        }
        super.onDestroy();
    }
}
