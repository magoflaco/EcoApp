package online.wiccagirl.kataralm

import android.Manifest
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.view.View
import android.view.WindowManager
import android.webkit.DownloadListener
import android.webkit.GeolocationPermissions
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.ActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import online.wiccagirl.kataralm.databinding.ActivityMainBinding
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var assetLoader: WebViewAssetLoader

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingCameraImageUri: Uri? = null

    private var pendingGeoOrigin: String? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result: ActivityResult ->
        val callback = filePathCallback
        filePathCallback = null

        if (callback == null) return@registerForActivityResult

        val uris = when {
            result.resultCode != RESULT_OK -> null
            result.data == null || result.data?.data == null -> {
                pendingCameraImageUri?.let { arrayOf(it) }
            }
            else -> {
                val data = result.data!!
                val clip = data.clipData
                if (clip != null && clip.itemCount > 0) {
                    Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                } else {
                    arrayOf(data.data!!)
                }
            }
        }

        pendingCameraImageUri = null
        callback.onReceiveValue(uris)
    }

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val granted = (grants[Manifest.permission.ACCESS_FINE_LOCATION] == true)
                || (grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true)

        val cb = pendingGeoCallback
        val origin = pendingGeoOrigin
        pendingGeoCallback = null
        pendingGeoOrigin = null

        cb?.invoke(origin, granted, false)
        if (!granted) {
            toast("Permiso de ubicación denegado")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Forzar a que use todo el espacio, incluyendo el área del notch
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }

        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { v, insets ->
            // Al no aplicar padding, el contenido se expande detrás de las barras del sistema (Edge-to-Edge)
            insets
        }

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        setupWebView()
        setupSwipeToRefresh()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.webView.canGoBack()) {
                    binding.webView.goBack()
                } else {
                    finish()
                }
            }
        })

        if (savedInstanceState != null) {
            binding.webView.restoreState(savedInstanceState)
        } else {
            binding.webView.loadUrl(APP_URL)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        binding.webView.saveState(outState)
    }

    private fun setupSwipeToRefresh() {
        // Deshabilitamos el gesto de deslizar para refrescar
        binding.swipeRefresh.isEnabled = false
    }

    private fun setupWebView() {
        val wv = binding.webView

        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true

            allowFileAccess = true
            allowContentAccess = true

            loadsImagesAutomatically = true
            mediaPlaybackRequiresUserGesture = false

            useWideViewPort = true
            loadWithOverviewMode = true

            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)

            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE

            userAgentString = "$userAgentString KataraLMAndroid"
        }

        wv.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                val host = url.host ?: ""
                val scheme = url.scheme?.lowercase(Locale.US) ?: return false

                // Si el enlace es externo (no es nuestra app interna) o es específicamente el de términos
                if (host != "appassets.androidplatform.net" || url.toString().contains("katara.pages.dev")) {
                    openExternal(url)
                    return true
                }

                return when (scheme) {
                    "http", "https" -> false
                    "mailto", "tel", "geo" -> {
                        openExternal(url)
                        true
                    }
                    else -> {
                        openExternal(url)
                        true
                    }
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                binding.loadingOverlay.hide()
                binding.swipeRefresh.isRefreshing = false
            }
        }

        wv.webChromeClient = object : WebChromeClient() {

            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                // Keep overlay visible until first full load.
                if (newProgress >= 80) {
                    binding.loadingOverlay.hideDelayed()
                } else {
                    binding.loadingOverlay.show()
                }
            }

            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                // Cancel any existing callback
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val allowMultiple = fileChooserParams.mode == FileChooserParams.MODE_OPEN_MULTIPLE

                val contentIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowMultiple)
                }

                val initialIntents = mutableListOf<Intent>()

                if (packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) {
                    createCameraIntent()?.let { initialIntents.add(it) }
                }

                val chooser = Intent(Intent.ACTION_CHOOSER).apply {
                    putExtra(Intent.EXTRA_INTENT, contentIntent)
                    putExtra(Intent.EXTRA_TITLE, "Selecciona una imagen")
                    if (initialIntents.isNotEmpty()) {
                        putExtra(Intent.EXTRA_INITIAL_INTENTS, initialIntents.toTypedArray())
                    }
                }

                return try {
                    fileChooserLauncher.launch(chooser)
                    true
                } catch (e: Exception) {
                    this@MainActivity.filePathCallback = null
                    toast("No se pudo abrir el selector de archivos")
                    false
                }
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback
            ) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false)
                    return
                }

                pendingGeoOrigin = origin
                pendingGeoCallback = callback

                locationPermissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                )
            }
        }

        wv.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            startDownload(url, contentDisposition, mimeType, userAgent)
        })
    }

    private fun startDownload(
        url: String,
        contentDisposition: String?,
        mimeType: String?,
        userAgent: String?
    ) {
        try {
            val uri = Uri.parse(url)
            val filename = URLUtil.guessFileName(url, contentDisposition, mimeType)

            val request = DownloadManager.Request(uri)
                .setTitle(filename)
                .setDescription("Descargando...")
                .setMimeType(mimeType)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)

            if (userAgent != null) {
                request.addRequestHeader("User-Agent", userAgent)
            }

            // DownloadManager handles permissions internally.
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)

            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)

            toast("Descarga iniciada: $filename")
        } catch (e: Exception) {
            toast("No se pudo descargar el archivo")
        }
    }

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: ActivityNotFoundException) {
            toast("No hay una app para abrir este enlace")
        }
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
        return fine == PackageManager.PERMISSION_GRANTED || coarse == PackageManager.PERMISSION_GRANTED
    }
    private fun createCameraIntent(): Intent? {
        val captureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        val handler = captureIntent.resolveActivity(packageManager) ?: return null

        val photoFile = createTempImageFile()
        val photoUri = FileProvider.getUriForFile(
            this,
            "${BuildConfig.APPLICATION_ID}.fileprovider",
            photoFile
        )
        pendingCameraImageUri = photoUri

        captureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
        captureIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        captureIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

        // Avoid unused-variable lint
        handler.toString()
        return captureIntent
    }

    private fun createTempImageFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES) ?: filesDir
        return File.createTempFile("KATARA_${timeStamp}_", ".jpg", storageDir)
    }

    private fun toast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }

    private fun android.view.View.show() {
        if (visibility != android.view.View.VISIBLE) visibility = android.view.View.VISIBLE
    }

    private fun android.view.View.hide() {
        if (visibility != android.view.View.GONE) visibility = android.view.View.GONE
    }

    private fun android.view.View.hideDelayed(delayMs: Long = 250L) {
        postDelayed({ hide() }, delayMs)
    }

    companion object {
        // Served by WebViewAssetLoader (stable HTTPS origin instead of file://)
        private const val APP_URL = "https://appassets.androidplatform.net/assets/webapp/index.html"
    }
}
