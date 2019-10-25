import { ToneAudioNodeOptions } from "../core/context/ToneAudioNode";
import { optionsFromArguments } from "../core/util/Defaults";
import { isArray, isFunction, isUndef } from "../core/util/TypeCheck";
import { Signal, SignalOptions } from "./Signal";
import { SignalOperator } from "./SignalOperator";

export type WaveShaperMappingFn = (value: number, index?: number) => number;

type WaveShaperMapping = WaveShaperMappingFn | number[] | Float32Array;

interface WaveShaperOptions extends ToneAudioNodeOptions {
	mapping?: WaveShaperMapping;
	length: number;
	curve?: number[] | Float32Array;
}

/**
 * Wraps the native Web Audio API
 * [WaveShaperNode](http://webaudio.github.io/web-audio-api/#the-waveshapernode-interface).
 *
 * @example
 * import { Oscillator, Signal, WaveShaper } from "tone";
 * const osc = new Oscillator().toDestination().start();
 * // multiply the output of the signal by 2 using the waveshaper's function
 * const timesTwo = new WaveShaper((val) => val * 2, 2048).connect(osc.frequency);
 * const signal = new Signal(440).connect(timesTwo);
 * @category Signal
 */
export class WaveShaper extends SignalOperator<WaveShaperOptions> {

	readonly name: string = "WaveShaper";

	/**
	 * the waveshaper node
	 */
	private _shaper: WaveShaperNode = this.context.createWaveShaper();

	/**
	 * The input to the waveshaper node.
	 */
	input = this._shaper;

	/**
	 * The output from the waveshaper node
	 */
	output = this._shaper;

	/**
	 * @param mapping The function used to define the values.
	 *                The mapping function should take two arguments:
	 *                the first is the value at the current position
	 *                and the second is the array position.
	 *                If the argument is an array, that array will be
	 *                set as the wave shaping function. The input
	 *                signal is an AudioRange [-1, 1] value and the output
	 *                signal can take on any numerical values.
	 *
	 * @param bufferLen The length of the WaveShaperNode buffer.
	 */
	constructor(mapping?: WaveShaperMapping, length?: number);
	constructor(options?: Partial<WaveShaperOptions>);
	constructor() {
		super(Object.assign(optionsFromArguments(WaveShaper.getDefaults(), arguments, ["mapping", "length"])));
		const options = optionsFromArguments(WaveShaper.getDefaults(), arguments, ["mapping", "length"]);

		if (isArray(options.mapping) || options.mapping instanceof Float32Array) {
			this.curve = Float32Array.from(options.mapping);
		} else if (isFunction(options.mapping)) {
			this.setMap(options.mapping, options.length);
		}
	}

	static getDefaults(): WaveShaperOptions {
		return Object.assign(Signal.getDefaults(), {
			length: 1024,
		});
	}

	/**
	 * Uses a mapping function to set the value of the curve.
	 * @param mapping The function used to define the values.
	 *                The mapping function take two arguments:
	 *                the first is the value at the current position
	 *                which goes from -1 to 1 over the number of elements
	 *                in the curve array. The second argument is the array position.
	 * @example
	 * import { WaveShaper } from "tone";
	 * const shaper = new WaveShaper();
	 * // map the input signal from [-1, 1] to [0, 10]
	 * shaper.setMap((val, index) => (val + 1) * 5);
	 */
	setMap(mapping: WaveShaperMappingFn, length: number = 1024): this {
		const array = new Float32Array(length);
		for (let i = 0, len = length; i < len; i++) {
			const normalized = (i / (len - 1)) * 2 - 1;
			array[i] = mapping(normalized, i);
		}
		this.curve = array;
		return this;
	}

	/**
	 * The array to set as the waveshaper curve. For linear curves
	 * array length does not make much difference, but for complex curves
	 * longer arrays will provide smoother interpolation.
	 */
	get curve(): Float32Array | null {
		return this._shaper.curve;
	}

	set curve(mapping: Float32Array | null) {
		this._shaper.curve = mapping;
	}

	/**
	 * Specifies what type of oversampling (if any) should be used when
	 * applying the shaping curve. Can either be "none", "2x" or "4x".
	 */
	get oversample(): OverSampleType {
		return this._shaper.oversample;
	}

	set oversample(oversampling: OverSampleType) {
		const isOverSampleType = ["none", "2x", "4x"].some(str => str.includes(oversampling));
		this.assert(isOverSampleType, "oversampling must be either 'none', '2x', or '4x'");
		this._shaper.oversample = oversampling;
	}

	/**
	 * Clean up.
	 */
	dispose(): this {
		super.dispose();
		this._shaper.disconnect();
		return this;
	}
}
