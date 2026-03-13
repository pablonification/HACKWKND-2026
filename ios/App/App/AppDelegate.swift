import UIKit
import WebKit
import Capacitor

let talekaCreamBackground = UIColor(red: 1.0, green: 0.976, blue: 0.914, alpha: 1.0)
let talekaLaunchOverlayTag = 9_841

protocol TalekaLaunchOverlayHost: AnyObject {
    func dismissLaunchOverlay()
}

func makeTalekaLaunchOverlayView() -> UIView {
    let overlay = UIView()
    overlay.tag = talekaLaunchOverlayTag
    overlay.translatesAutoresizingMaskIntoConstraints = false
    overlay.backgroundColor = talekaCreamBackground
    overlay.isUserInteractionEnabled = false

    let logoView = UIImageView(image: UIImage(named: "SplashLogo"))
    logoView.translatesAutoresizingMaskIntoConstraints = false
    logoView.contentMode = .scaleAspectFit

    let footerView = UIImageView(image: UIImage(named: "SplashFooter"))
    footerView.translatesAutoresizingMaskIntoConstraints = false
    footerView.contentMode = .scaleAspectFit

    overlay.addSubview(logoView)
    overlay.addSubview(footerView)

    NSLayoutConstraint.activate([
        logoView.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
        logoView.centerYAnchor.constraint(equalTo: overlay.centerYAnchor, constant: -10.5),
        logoView.widthAnchor.constraint(equalToConstant: 176),
        logoView.heightAnchor.constraint(equalToConstant: 206),
        footerView.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
        footerView.bottomAnchor.constraint(equalTo: overlay.safeAreaLayoutGuide.bottomAnchor, constant: -63),
        footerView.widthAnchor.constraint(equalToConstant: 152),
        footerView.heightAnchor.constraint(equalToConstant: 53),
    ])

    return overlay
}

func installTalekaLaunchOverlay(on window: UIWindow) {
    guard window.viewWithTag(talekaLaunchOverlayTag) == nil else {
        return
    }

    let overlay = makeTalekaLaunchOverlayView()
    window.addSubview(overlay)
    NSLayoutConstraint.activate([
        overlay.leadingAnchor.constraint(equalTo: window.leadingAnchor),
        overlay.trailingAnchor.constraint(equalTo: window.trailingAnchor),
        overlay.topAnchor.constraint(equalTo: window.topAnchor),
        overlay.bottomAnchor.constraint(equalTo: window.bottomAnchor),
    ])
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        if #unavailable(iOS 13.0) {
            let window = UIWindow(frame: UIScreen.main.bounds)
            window.backgroundColor = talekaCreamBackground
            window.rootViewController = TalekaLaunchViewController()
            window.makeKeyAndVisible()
            installTalekaLaunchOverlay(on: window)
            self.window = window
        } else {
            self.window?.backgroundColor = talekaCreamBackground
            self.window?.rootViewController?.view.backgroundColor = talekaCreamBackground
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

class TalekaLaunchViewController: UIViewController, TalekaLaunchOverlayHost {
    private var bridgeViewController: TalekaBridgeViewController?
    private var bridgeAttached = false
    private var overlayDismissed = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = talekaCreamBackground

        let logoView = UIImageView(image: UIImage(named: "SplashLogo"))
        logoView.translatesAutoresizingMaskIntoConstraints = false
        logoView.contentMode = .scaleAspectFit

        let footerView = UIImageView(image: UIImage(named: "SplashFooter"))
        footerView.translatesAutoresizingMaskIntoConstraints = false
        footerView.contentMode = .scaleAspectFit

        view.addSubview(logoView)
        view.addSubview(footerView)

        NSLayoutConstraint.activate([
            logoView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            logoView.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -10.5),
            logoView.widthAnchor.constraint(equalToConstant: 176),
            logoView.heightAnchor.constraint(equalToConstant: 206),
            footerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            footerView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -63),
            footerView.widthAnchor.constraint(equalToConstant: 152),
            footerView.heightAnchor.constraint(equalToConstant: 53),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)

        guard !bridgeAttached else {
            return
        }

        bridgeAttached = true
        DispatchQueue.main.async { [weak self] in
            self?.attachBridgeViewController()
        }
    }

    func dismissLaunchOverlay() {
        guard !overlayDismissed else {
            return
        }

        overlayDismissed = true
        if let windowOverlay = view.window?.viewWithTag(talekaLaunchOverlayTag) {
            UIView.animate(withDuration: 0.16, delay: 0, options: [.curveEaseOut], animations: {
                windowOverlay.alpha = 0
            }, completion: { _ in
                windowOverlay.removeFromSuperview()
            })
        }
        let bridgeView = bridgeViewController?.view
        let overlaySubviews = view.subviews.filter { $0 !== bridgeView }

        UIView.animate(withDuration: 0.16, delay: 0, options: [.curveEaseOut], animations: {
            overlaySubviews.forEach { $0.alpha = 0 }
        }, completion: { _ in
            overlaySubviews.forEach { $0.removeFromSuperview() }
        })
    }

    private func attachBridgeViewController() {
        guard bridgeViewController == nil else {
            return
        }

        let bridgeViewController = TalekaBridgeViewController()
        bridgeViewController.overlayHost = self
        addChild(bridgeViewController)
        bridgeViewController.view.translatesAutoresizingMaskIntoConstraints = false
        bridgeViewController.view.backgroundColor = talekaCreamBackground
        view.insertSubview(bridgeViewController.view, at: 0)

        NSLayoutConstraint.activate([
            bridgeViewController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bridgeViewController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bridgeViewController.view.topAnchor.constraint(equalTo: view.topAnchor),
            bridgeViewController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        bridgeViewController.didMove(toParent: self)
        self.bridgeViewController = bridgeViewController
    }
}

class TalekaBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private let launchOverlayMessageName = "talekaLaunchOverlay"
    weak var overlayHost: TalekaLaunchOverlayHost?

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: launchOverlayMessageName)
    }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        configuration.userContentController.removeScriptMessageHandler(forName: launchOverlayMessageName)
        configuration.userContentController.add(self, name: launchOverlayMessageName)
        let wv = WKWebView(frame: frame, configuration: configuration)
        wv.isOpaque = false
        wv.backgroundColor = talekaCreamBackground
        wv.scrollView.isOpaque = false
        wv.scrollView.backgroundColor = talekaCreamBackground
        if #available(iOS 15.0, *) {
            wv.underPageBackgroundColor = talekaCreamBackground
        }
        return wv
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        applyLaunchColors()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        applyLaunchColors()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == launchOverlayMessageName else {
            return
        }
        overlayHost?.dismissLaunchOverlay()
    }

    private func applyLaunchColors() {
        view.backgroundColor = talekaCreamBackground
        webView?.isOpaque = false
        webView?.backgroundColor = talekaCreamBackground
        webView?.scrollView.isOpaque = false
        webView?.scrollView.backgroundColor = talekaCreamBackground
        if #available(iOS 15.0, *) {
            webView?.underPageBackgroundColor = talekaCreamBackground
        }
    }
}
