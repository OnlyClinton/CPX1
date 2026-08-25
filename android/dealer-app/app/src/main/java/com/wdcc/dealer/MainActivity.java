package com.wdcc.dealer;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4013;
    private static final String DEALER_URL = "https://wdcc-cpx-launch-cpxagency.vercel.app/dealer";

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

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
        settings.setUserAgentString(settings.getUserAgentString() + " WDCCDealerApp/1.0");

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
                String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();

                if ((scheme.equals("https") || scheme.equals("http")) && isTrustedHost(host)) {
                    return false;
                }
                if (scheme.equals("tel") || scheme.equals("sms") || scheme.equals("mailto")) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                if (scheme.equals("https") || scheme.equals("http")) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> newCallback, FileChooserParams params) {
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
                        cameraUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", image);
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
                startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                return true;
            }
        });

        if (savedInstanceState == null) webView.loadUrl(DEALER_URL);
        else webView.restoreState(savedInstanceState);
    }

    private boolean isTrustedHost(String host) {
        return host.equals("wdcc-cpx-launch-cpxagency.vercel.app")
                || host.equals("dealer.wedontcarecars.com")
                || host.equals("wedontcarecars.com")
                || host.equals("www.wedontcarecars.com")
                || host.endsWith(".vercel-storage.com")
                || host.endsWith(".blob.vercel-storage.com")
                || host.endsWith(".public.blob.vercel-storage.com");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileCallback == null) return;

        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                ClipData clip = data.getClipData();
                result = new Uri[clip.getItemCount()];
                for (int i = 0; i < clip.getItemCount(); i++) result[i] = clip.getItemAt(i).getUri();
            } else if (data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            } else if (cameraUri != null) {
                result = new Uri[]{cameraUri};
            }
        }

        fileCallback.onReceiveValue(result);
        fileCallback = null;
        cameraUri = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        fileCallback = null;
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
