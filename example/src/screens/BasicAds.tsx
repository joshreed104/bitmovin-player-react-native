import { useFocusEffect } from "@react-navigation/native";
import {
	type AdBreakStartedEvent,
	type AdSkippedEvent,
	AdSourceType,
	type AdStartedEvent,
	type AdvertisingConfig,
	type Event,
	type PlayEvent,
	PlayerView,
	type PlayerViewConfig,
	type ReadyEvent,
	SourceType,
	usePlayer,
} from "bitmovin-player-react-native";
import React, { useCallback, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTVGestures } from "../hooks";

function prettyPrint(header: string, obj: any) {
	// console.log(header, JSON.stringify(obj, null, 2));
}

const withCorrelator = (tag: string): string =>
	`${tag}${Math.floor(Math.random() * 100000)}`;

const adTags = {
	vastSkippable: withCorrelator(
		"https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&correlator=",
	),
	vast1: withCorrelator(
		"https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319096/external/single_ad_samples&ciu_szs=300x250&impl=s&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ct%3Dlinear&correlator=",
	),
	vast2: withCorrelator(
		"https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319096/external/ad_rule_samples&ciu_szs=300x250&ad_rule=1&impl=s&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ar%3Dpostonly&cmsid=496&vid=short_onecue&correlator=",
	),
	sinclairVertical: withCorrelator(
		"https://securepubads.g.doubleclick.net/gampad/ads?sz=360x480&env=vp&gdfp_req=1&description_url=https://demonews3.com&output=vast&unviewed_position_start=1&url=https://demonews3.com&vpos=preroll&iu=/4756/DEMO/News_App/video-shorts&rdid=AC31E1DE-0C38-4E66-BB83-AF0218836DA1&is_lat=0&idtype=idfa&ppid=c7acf369-73c7-44e6-990b-df4910acf19f&ad_rule=0&pp=vertical&cust_params=page%3Dvideoshorts%26w%3D360%26h%3D480%26slug%3D/video-shorts%26path%3D/video-shorts%26pos%3D1%26bundle_id%3Dcom.sinclair.demonews3%26vtype%3Dvertical-video%26kw%3D%26appVersionId%3D10.19.0",
	),
};

const advertisingConfig: AdvertisingConfig = {
	schedule: [
		// First ad item at "pre" (default) position.
		{
			sources: [
				{
					tag: adTags.sinclairVertical,
					type: AdSourceType.IMA,
				},
			],
		},
	],
};

const remoteControlConfig = {
	isCastEnabled: false,
};

const playerViewConfig: PlayerViewConfig = {
	hideFirstFrame: true,
};

export default function BasicAds() {
	useTVGestures();

	const player = usePlayer({ advertisingConfig, remoteControlConfig });

	// Performance measurement timestamps
	const componentMountTime = useRef<number | null>(null);
	const playerLoadedTime = useRef<number | null>(null);
	const adReadyTime = useRef<number | null>(null);
	const playCommandTime = useRef<number | null>(null);

	// Performance tracking refs and state
	const scrollViewRef = useRef<ScrollView>(null);
	const loadStartTimeRef = useRef<number>(0);
	const playStartTimeRef = useRef<number>(0);
	const [logs, setLogs] = useState<string[]>([]);
	const [isReady, setIsReady] = useState(false);
	const [hasStartedPlaying, setHasStartedPlaying] = useState(false);

	useFocusEffect(
		useCallback(() => {
			// Track component mount time
			componentMountTime.current = Date.now();
			playerLoadedTime.current = null;
			adReadyTime.current = null;
			playCommandTime.current = null;

			// Initialize performance tracking
			loadStartTimeRef.current = performance.now();
			playStartTimeRef.current = 0;
			setLogs([]);
			setIsReady(false);
			setHasStartedPlaying(false);

			player.load({
				url:
					Platform.OS === "ios"
						? "https://cdn.bitmovin.com/content/internal/assets/MI201109210084/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8"
						: "https://cdn.bitmovin.com/content/internal/assets/MI201109210084/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd",
				type: Platform.OS === "ios" ? SourceType.HLS : SourceType.DASH,
				title: "Art of Motion",
				poster:
					"https://cdn.bitmovin.com/content/internal/assets/MI201109210084/poster.jpg",
			});
			return () => {
				player.destroy();
			};
		}, [player]),
	);

	const onEvent = useCallback((event: Event) => {
		prettyPrint(`[${event.name}]`, event);
	}, []);

	const onSourceLoaded = useCallback(
		(event: Event) => {
			onEvent(event);
			// Performance measurement 1: Component load → Player loaded
			if (componentMountTime.current !== null) {
				playerLoadedTime.current = Date.now();
			}
			// Dinamically schedule an ad to play after the video
			// player.scheduleAd({
			// 	position: "post",
			// 	sources: [
			// 		{
			// 			tag: adTags.vast2,
			// 			type: AdSourceType.IMA,
			// 		},
			// 	],
			// });
		},
		[onEvent],
	);

	const onAdSkipped = useCallback(
		(event: AdSkippedEvent) => {
			onEvent(event);
			prettyPrint(`[${event.name}]`, `ID (${event.ad?.id})`);
		},
		[onEvent],
	);

	const addLog = useCallback((message: string) => {
		const timestamp = new Date().toLocaleTimeString();
		const logEntry = `[${timestamp}] ${message}`;
		console.log(message);
		setLogs((prev) => {
			const newLogs = [...prev, logEntry].slice(-50); // Keep last 50 logs
			// Auto-scroll to bottom when new log is added
			setTimeout(() => {
				scrollViewRef.current?.scrollToEnd({ animated: true });
			}, 100);
			return newLogs;
		});
	}, []);

	const onAdManifestLoaded = useCallback(
		(_event: Event) => {
			onEvent(_event);
			// Performance measurement: Ad manifest loaded
			const elapsedFromLoad = performance.now() - loadStartTimeRef.current;
			addLog(
				`[TIMING] 📦 onAdManifestLoaded: ${elapsedFromLoad.toFixed(0)}ms from load`,
			);
		},
		[onEvent, addLog],
	);

	const onReady = useCallback(
		(_event: ReadyEvent) => {
			const elapsed = performance.now() - loadStartTimeRef.current;
			addLog(`[TIMING] onReady: ${elapsed.toFixed(0)}ms from load`);
			setIsReady(true);
		},
		[addLog],
	);

	const handlePlay = useCallback(
		(_event: PlayEvent) => {
			// Track when play event fires (playback is starting)
			// NOTE: this doesn't seem to reliably set the time when play is pressed
			if (playStartTimeRef.current === 0) {
				playStartTimeRef.current = performance.now();
				addLog("[TIMING] ▶️ Play event fired");
				setHasStartedPlaying(true);
			}
		},
		[addLog],
	);

	const onAdBreakStarted = useCallback(
		(_event: AdBreakStartedEvent) => {
			// Set play time if not already set (for pre-roll ads that start before onPlay fires)
			if (playStartTimeRef.current === 0) {
				playStartTimeRef.current = performance.now();
				addLog("[TIMING] ▶️ Play time set from onAdBreakStarted");
			}
			const elapsedFromPlay = performance.now() - playStartTimeRef.current;
			addLog(
				`[TIMING] onAdBreakStarted: ${elapsedFromPlay.toFixed(0)}ms from play`,
			);
		},
		[addLog],
	);

	const onAdStarted = useCallback(
		(_event: AdStartedEvent) => {
			// Set play time if not already set (fallback if onAdBreakStarted didn't fire)
			const elapsedFromPlay = performance.now() - playStartTimeRef.current;
			addLog(
				`[TIMING] ✅ onAdStarted: ${elapsedFromPlay.toFixed(0)}ms from play`,
			);
		},
		[addLog],
	);

	return (
		<View style={styles.container}>
			<PlayerView
				player={player}
				onReady={onReady}
				style={styles.player}
				config={playerViewConfig}
				onAdBreakFinished={onEvent}
				onAdBreakStarted={onAdBreakStarted}
				onAdClicked={onEvent}
				onAdError={onEvent}
				onAdFinished={onEvent}
				onAdManifestLoad={onEvent}
				onAdManifestLoaded={onAdManifestLoaded}
				onAdQuartile={onEvent}
				onAdScheduled={onEvent}
				onAdSkipped={onAdSkipped}
				onAdStarted={onAdStarted}
				onPlay={handlePlay}
				onSourceLoaded={onSourceLoaded}
			/>
			<View style={styles.logContainer}>
				<Text style={styles.logTitle}>Performance Logs</Text>
				<ScrollView
					ref={scrollViewRef}
					style={styles.logScrollView}
					contentContainerStyle={styles.logContent}
				>
					{logs.length === 0 ? (
						<Text style={styles.logEmpty}>No logs yet...</Text>
					) : (
						logs.map((log) => (
							<Text key={log} style={styles.logEntry}>
								{log}
							</Text>
						))
					)}
				</ScrollView>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "black",
	},
	player: {
		flex: 1,
	},
	logContainer: {
		height: 150,
		backgroundColor: "rgba(0, 0, 0, 0.8)",
		borderTopWidth: 1,
		borderTopColor: "#333",
		padding: 8,
	},
	logTitle: {
		color: "#fff",
		fontSize: 12,
		fontWeight: "bold",
		marginBottom: 4,
	},
	logScrollView: {
		flex: 1,
	},
	logContent: {
		paddingBottom: 8,
	},
	logEntry: {
		color: "#0f0",
		fontSize: 10,
		fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
		marginBottom: 2,
	},
	logEmpty: {
		color: "#666",
		fontSize: 10,
		fontStyle: "italic",
	},
});

