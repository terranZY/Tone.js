import { Gain } from "../../core/context/Gain";
import { AudioRange, Cents, Degrees, Frequency, Positive, Time } from "../../core/type/Units";
import { optionsFromArguments } from "../../core/util/Defaults";
import { readOnly } from "../../core/util/Interface";
import { Multiply } from "../../signal/Multiply";
import { Signal } from "../../signal/Signal";
import { Source } from "../Source";
import { Oscillator } from "./Oscillator";
import { FMConstructorOptions, FMOscillatorOptions,
	generateWaveform, NonCustomOscillatorType, ToneOscillatorInterface, ToneOscillatorType } from "./OscillatorInterface";

export { FMOscillatorOptions } from "./OscillatorInterface";
/**
 * FMOscillator implements a frequency modulation synthesis
 * ```
 *                                              +-------------+
 * +---------------+        +-------------+     | Carrier Osc |
 * | Modulator Osc +>-------> GainNode    |     |             +--->Output
 * +---------------+        |             +>----> frequency   |
 *                       +--> gain        |     +-------------+
 *                       |  +-------------+
 * +-----------------+   |
 * | modulationIndex +>--+
 * +-----------------+
 * ```
 *
 * @example
 * import { FMOscillator } from "tone";
 * // a sine oscillator frequency-modulated by a square wave
 * const fmOsc = new FMOscillator("Ab3", "sine", "square").toDestination().start();
 * @category Source
 */
export class FMOscillator extends Source<FMOscillatorOptions> implements ToneOscillatorInterface {

	readonly name: string = "FMOscillator";

	/**
	 * The carrier oscillator
	 */
	private _carrier: Oscillator;

	readonly frequency: Signal<Frequency>;
	readonly detune: Signal<Cents>;

	/**
	 * The modulating oscillator
	 */
	private _modulator: Oscillator;

	/**
	 * Harmonicity is the frequency ratio between the carrier and the modulator oscillators.
	 * A harmonicity of 1 gives both oscillators the same frequency.
	 * Harmonicity = 2 means a change of an octave.
	 * @example
	 * import { FMOscillator } from "tone";
	 * const fmOsc = new FMOscillator("D2").toDestination().start();
	 * // pitch the modulator an octave below carrier
	 * fmOsc.harmonicity.value = 0.5;
	 */
	readonly harmonicity: Signal<Positive>;

	/**
	 * The modulation index which is in essence the depth or amount of the modulation. In other terms it is the
	 * ratio of the frequency of the modulating signal (mf) to the amplitude of the
	 * modulating signal (ma) -- as in ma/mf.
	 */
	readonly modulationIndex: Signal<Positive>;

	/**
	 * the node where the modulation happens
	 */
	private _modulationNode: Gain = new Gain({
		context: this.context,
		gain: 0,
	});

	/**
	 * @param frequency The starting frequency of the oscillator.
	 * @param type The type of the carrier oscillator.
	 * @param modulationType The type of the modulator oscillator.
	 */
	constructor(frequency?: Frequency, type?: ToneOscillatorType, modulationType?: ToneOscillatorType);
	constructor(options?: Partial<FMConstructorOptions>);
	constructor() {

		super(optionsFromArguments(FMOscillator.getDefaults(), arguments, ["frequency", "type", "modulationType"]));
		const options = optionsFromArguments(FMOscillator.getDefaults(), arguments, ["frequency", "type", "modulationType"]);

		this._carrier = new Oscillator({
			context: this.context,
			detune: options.detune,
			frequency: 0,
			onstop: () => this.onstop(this),
			phase: options.phase,
			type: options.type,
		} as OscillatorOptions);

		this.detune = this._carrier.detune;

		this.frequency = new Signal({
			context: this.context,
			units: "frequency",
			value: options.frequency,
		});

		this._modulator = new Oscillator({
			context: this.context,
			phase: options.phase,
			type: options.modulationType,
		} as OscillatorOptions);

		this.harmonicity = new Multiply({
			context: this.context,
			units: "positive",
			value: options.harmonicity,
		});

		this.modulationIndex = new Multiply({
			context: this.context,
			units: "positive",
			value: options.modulationIndex,
		});

		// connections
		this.frequency.connect(this._carrier.frequency);
		this.frequency.chain(this.harmonicity, this._modulator.frequency);
		this.frequency.chain(this.modulationIndex, this._modulationNode);
		this._modulator.connect(this._modulationNode.gain);
		this._modulationNode.connect(this._carrier.frequency);
		this._carrier.connect(this.output);
		this.detune.connect(this._modulator.detune);

		readOnly(this, ["modulationIndex", "frequency", "detune", "harmonicity"]);
	}

	static getDefaults(): FMOscillatorOptions {
		return Object.assign(Oscillator.getDefaults(), {
			harmonicity: 1,
			modulationIndex: 2,
			modulationType: "square" as NonCustomOscillatorType,
		});
	}

	/**
	 * start the oscillator
	 */
	protected _start(time: Time): void {
		this._modulator.start(time);
		this._carrier.start(time);
	}

	/**
	 * stop the oscillator
	 */
	protected _stop(time: Time): void {
		this._modulator.stop(time);
		this._carrier.stop(time);
	}

	/**
	 * stop and restart the oscillator
	 */
	restart(time?: Time): this {
		this._modulator.restart(time);
		this._carrier.restart(time);
		return this;
	}

	get type(): ToneOscillatorType {
		return this._carrier.type;
	}
	set type(type: ToneOscillatorType) {
		this._carrier.type = type;
	}

	get baseType(): OscillatorType {
		return this._carrier.baseType;
	}
	set baseType(baseType: OscillatorType) {
		this._carrier.baseType = baseType;
	}

	get partialCount(): number {
		return this._carrier.partialCount;
	}
	set partialCount(partialCount: number) {
		this._carrier.partialCount = partialCount;
	}

	/**
	 * The type of the modulator oscillator
	 */
	get modulationType(): ToneOscillatorType {
		return this._modulator.type;
	}
	set modulationType(type: ToneOscillatorType) {
		this._modulator.type = type;
	}

	get phase(): Degrees {
		return this._carrier.phase;
	}
	set phase(phase: Degrees) {
		this._carrier.phase = phase;
		this._modulator.phase = phase;
	}

	get partials(): number[] {
		return this._carrier.partials;
	}
	set partials(partials: number[]) {
		this._carrier.partials = partials;
	}

	async asArray(length: number = 1024): Promise<Float32Array> {
		return generateWaveform(this, length);
	}

	/**
	 * Clean up.
	 */
	dispose(): this {
		super.dispose();
		this.frequency.dispose();
		this.harmonicity.dispose();
		this._carrier.dispose();
		this._modulator.dispose();
		this._modulationNode.dispose();
		this.modulationIndex.dispose();
		return this;
	}
}
