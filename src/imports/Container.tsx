function Title() {
  return (
    <div className="relative shrink-0 w-full" data-name="Title">
      <div className="flex flex-row items-end size-full">
        <div className="content-stretch flex gap-[6px] items-end pl-[6px] relative w-full">
          <div className="flex flex-col font-['Nunito_Sans:Bold',sans-serif] font-bold justify-center leading-[0] relative shrink-0 text-[#3e465b] text-[12px] whitespace-nowrap" style={{ fontVariationSettings: "'YTLC' 500, 'wdth' 100" }}>
            <p className="leading-[1.49]">Timeframe</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputContainer() {
  return (
    <div className="content-stretch flex flex-[1_0_0] items-center min-h-px min-w-px relative" data-name="Input Container">
      <div className="flex flex-[1_0_0] flex-col font-['Nunito_Sans:SemiBold',sans-serif] font-semibold justify-center leading-[0] min-h-px min-w-px overflow-hidden relative text-[14px] text-black text-ellipsis whitespace-nowrap" style={{ fontVariationSettings: "'YTLC' 500, 'wdth' 100" }}>
        <p className="leading-[1.2] overflow-hidden">Month to Date</p>
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="relative rounded-[20px] shrink-0 size-[24px]" data-name="Container">
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center p-[16px] relative size-full">
          <div className="flex flex-col font-['Font_Awesome_7_Pro:Solid',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#005390] text-[14px] text-center tracking-[-0.28px] w-full">
            <p className="leading-[normal]"></p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="relative rounded-[20px] shrink-0 size-[24px]" data-name="Container">
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center p-[16px] relative size-full">
          <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 size-[16px]" data-name="chevron_down">
            <Container2 />
          </div>
        </div>
      </div>
    </div>
  );
}

function TrailingIcon() {
  return (
    <div className="content-stretch flex flex-col items-center justify-center relative shrink-0" data-name="Trailing Icon">
      <div className="relative shrink-0 size-[16px]" data-name="Type=Chevron / Down">
        <div className="absolute content-stretch flex flex-col items-center justify-center left-0 size-[16px] top-0" data-name="Icon">
          <Container1 />
        </div>
      </div>
    </div>
  );
}

function Field() {
  return (
    <div className="bg-white h-[40px] relative rounded-[6px] shrink-0 w-full" data-name="Field">
      <div className="flex flex-row items-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex gap-[6px] items-center px-[10px] py-[11px] relative size-full">
          <div className="content-stretch flex flex-[1_0_0] items-center min-h-px min-w-px relative" data-name="State=Filled">
            <InputContainer />
          </div>
          <TrailingIcon />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#9fa6bc] border-solid inset-0 pointer-events-none rounded-[6px]" />
    </div>
  );
}

function Div() {
  return (
    <div className="content-stretch flex flex-col gap-[5px] items-start justify-center relative shrink-0 w-full" data-name="Div">
      <Title />
      <Field />
    </div>
  );
}

function Title1() {
  return (
    <div className="relative shrink-0 w-full" data-name="Title">
      <div className="flex flex-row items-end size-full">
        <div className="content-stretch flex gap-[6px] items-end pl-[6px] relative w-full">
          <div className="flex flex-col font-['Nunito_Sans:Bold',sans-serif] font-bold justify-center leading-[0] relative shrink-0 text-[#3e465b] text-[12px] whitespace-nowrap" style={{ fontVariationSettings: "'YTLC' 500, 'wdth' 100" }}>
            <p className="leading-[1.49]">Metric</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputContainer1() {
  return (
    <div className="content-stretch flex flex-[1_0_0] items-center min-h-px min-w-px relative" data-name="Input Container">
      <div className="flex flex-[1_0_0] flex-col font-['Nunito_Sans:SemiBold',sans-serif] font-semibold justify-center leading-[0] min-h-px min-w-px overflow-hidden relative text-[14px] text-black text-ellipsis whitespace-nowrap" style={{ fontVariationSettings: "'YTLC' 500, 'wdth' 100" }}>
        <p className="leading-[1.2] overflow-hidden">PPD</p>
      </div>
    </div>
  );
}

function Container4() {
  return (
    <div className="relative rounded-[20px] shrink-0 size-[24px]" data-name="Container">
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center p-[16px] relative size-full">
          <div className="flex flex-col font-['Font_Awesome_7_Pro:Solid',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#005390] text-[14px] text-center tracking-[-0.28px] w-full">
            <p className="leading-[normal]"></p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Container3() {
  return (
    <div className="relative rounded-[20px] shrink-0 size-[24px]" data-name="Container">
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center p-[16px] relative size-full">
          <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 size-[16px]" data-name="chevron_down">
            <Container4 />
          </div>
        </div>
      </div>
    </div>
  );
}

function TrailingIcon1() {
  return (
    <div className="content-stretch flex flex-col items-center justify-center relative shrink-0" data-name="Trailing Icon">
      <div className="relative shrink-0 size-[16px]" data-name="Type=Chevron / Down">
        <div className="absolute content-stretch flex flex-col items-center justify-center left-0 size-[16px] top-0" data-name="Icon">
          <Container3 />
        </div>
      </div>
    </div>
  );
}

function Field1() {
  return (
    <div className="bg-white h-[40px] relative rounded-[6px] shrink-0 w-full" data-name="Field">
      <div className="flex flex-row items-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex gap-[6px] items-center px-[10px] py-[11px] relative size-full">
          <div className="content-stretch flex flex-[1_0_0] items-center min-h-px min-w-px relative" data-name="State=Filled">
            <InputContainer1 />
          </div>
          <TrailingIcon1 />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#9fa6bc] border-solid inset-0 pointer-events-none rounded-[6px]" />
    </div>
  );
}

function Div1() {
  return (
    <div className="content-stretch flex flex-col gap-[5px] items-start justify-center relative shrink-0 w-full" data-name="Div">
      <Title1 />
      <Field1 />
    </div>
  );
}

function Title2() {
  return (
    <div className="relative shrink-0 w-full" data-name="Title">
      <div className="flex flex-row items-end size-full">
        <div className="content-stretch flex gap-[6px] items-end pl-[6px] relative w-full">
          <div className="flex flex-col font-['Nunito_Sans:Bold',sans-serif] font-bold justify-center leading-[0] relative shrink-0 text-[#3e465b] text-[12px] whitespace-nowrap" style={{ fontVariationSettings: "'YTLC' 500, 'wdth' 100" }}>
            <p className="leading-[1.49]">Spend Mode</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputContainer2() {
  return (
    <div className="content-stretch flex flex-[1_0_0] items-center min-h-px min-w-px relative" data-name="Input Container">
      <div className="flex flex-[1_0_0] flex-col font-['Nunito_Sans:SemiBold',sans-serif] font-semibold justify-center leading-[0] min-h-px min-w-px overflow-hidden relative text-[14px] text-black text-ellipsis whitespace-nowrap" style={{ fontVariationSettings: "'YTLC' 500, 'wdth' 100" }}>
        <p className="leading-[1.2] overflow-hidden">Month to Date</p>
      </div>
    </div>
  );
}

function Container6() {
  return (
    <div className="relative rounded-[20px] shrink-0 size-[24px]" data-name="Container">
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center p-[16px] relative size-full">
          <div className="flex flex-col font-['Font_Awesome_7_Pro:Solid',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#005390] text-[14px] text-center tracking-[-0.28px] w-full">
            <p className="leading-[normal]"></p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Container5() {
  return (
    <div className="relative rounded-[20px] shrink-0 size-[24px]" data-name="Container">
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center p-[16px] relative size-full">
          <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 size-[16px]" data-name="chevron_down">
            <Container6 />
          </div>
        </div>
      </div>
    </div>
  );
}

function TrailingIcon2() {
  return (
    <div className="content-stretch flex flex-col items-center justify-center relative shrink-0" data-name="Trailing Icon">
      <div className="relative shrink-0 size-[16px]" data-name="Type=Chevron / Down">
        <div className="absolute content-stretch flex flex-col items-center justify-center left-0 size-[16px] top-0" data-name="Icon">
          <Container5 />
        </div>
      </div>
    </div>
  );
}

function Field2() {
  return (
    <div className="bg-white h-[40px] relative rounded-[6px] shrink-0 w-full" data-name="Field">
      <div className="flex flex-row items-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex gap-[6px] items-center px-[10px] py-[11px] relative size-full">
          <div className="content-stretch flex flex-[1_0_0] items-center min-h-px min-w-px relative" data-name="State=Filled">
            <InputContainer2 />
          </div>
          <TrailingIcon2 />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#9fa6bc] border-solid inset-0 pointer-events-none rounded-[6px]" />
    </div>
  );
}

function Div2() {
  return (
    <div className="content-stretch flex flex-col gap-[5px] items-start justify-center relative shrink-0 w-full" data-name="Div">
      <Title2 />
      <Field2 />
    </div>
  );
}

function Frame() {
  return (
    <div className="content-stretch flex gap-[13px] items-center relative shrink-0">
      <div className="content-stretch flex flex-col gap-[5px] items-start max-w-[360px] relative shrink-0 w-[174px]" data-name="Mulit-Use Input">
        <Div />
      </div>
      <div className="content-stretch flex flex-col gap-[5px] items-start max-w-[360px] relative shrink-0 w-[174px]" data-name="Mulit-Use Input">
        <Div1 />
      </div>
      <div className="content-stretch flex flex-col gap-[5px] items-start max-w-[360px] relative shrink-0 w-[174px]" data-name="Mulit-Use Input">
        <Div2 />
      </div>
    </div>
  );
}

function Title3() {
  return (
    <div className="relative shrink-0 w-full" data-name="Title">
      <div className="flex flex-row items-end size-full">
        <div className="content-stretch flex gap-[6px] items-end pl-[6px] relative w-full">
          <div className="flex flex-col font-['Nunito_Sans:Bold',sans-serif] font-bold justify-center leading-[0] relative shrink-0 text-[#3e465b] text-[12px] whitespace-nowrap" style={{ fontVariationSettings: "'YTLC' 500, 'wdth' 100" }}>
            <p className="leading-[1.49]">Table Size</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputContainer3() {
  return (
    <div className="content-stretch flex flex-[1_0_0] items-center min-h-px min-w-px relative" data-name="Input Container">
      <div className="flex flex-[1_0_0] flex-col font-['Nunito_Sans:SemiBold',sans-serif] font-semibold justify-center leading-[0] min-h-px min-w-px overflow-hidden relative text-[14px] text-black text-ellipsis whitespace-nowrap" style={{ fontVariationSettings: "'YTLC' 500, 'wdth' 100" }}>
        <p className="leading-[1.2] overflow-hidden">Standard</p>
      </div>
    </div>
  );
}

function Container9() {
  return (
    <div className="relative rounded-[20px] shrink-0 size-[24px]" data-name="Container">
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center p-[16px] relative size-full">
          <div className="flex flex-col font-['Font_Awesome_7_Pro:Solid',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#005390] text-[14px] text-center tracking-[-0.28px] w-full">
            <p className="leading-[normal]"></p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Container8() {
  return (
    <div className="relative rounded-[20px] shrink-0 size-[24px]" data-name="Container">
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center p-[16px] relative size-full">
          <div className="content-stretch flex flex-col items-center justify-center relative shrink-0 size-[16px]" data-name="chevron_down">
            <Container9 />
          </div>
        </div>
      </div>
    </div>
  );
}

function TrailingIcon3() {
  return (
    <div className="content-stretch flex flex-col items-center justify-center relative shrink-0" data-name="Trailing Icon">
      <div className="relative shrink-0 size-[16px]" data-name="Type=Chevron / Down">
        <div className="absolute content-stretch flex flex-col items-center justify-center left-0 size-[16px] top-0" data-name="Icon">
          <Container8 />
        </div>
      </div>
    </div>
  );
}

function Field3() {
  return (
    <div className="bg-white h-[40px] relative rounded-[6px] shrink-0 w-full" data-name="Field">
      <div className="flex flex-row items-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex gap-[6px] items-center px-[10px] py-[11px] relative size-full">
          <div className="content-stretch flex flex-[1_0_0] items-center min-h-px min-w-px relative" data-name="State=Filled">
            <InputContainer3 />
          </div>
          <TrailingIcon3 />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#9fa6bc] border-solid inset-0 pointer-events-none rounded-[6px]" />
    </div>
  );
}

function Div3() {
  return (
    <div className="content-stretch flex flex-col gap-[5px] items-start justify-center relative shrink-0 w-full" data-name="Div">
      <Title3 />
      <Field3 />
    </div>
  );
}

function Container7() {
  return (
    <div className="content-stretch flex flex-[1_0_0] items-center justify-end min-h-px min-w-px relative" data-name="Container">
      <div className="max-w-[360px] relative shrink-0 w-[174px]" data-name="Mulit-Use Input">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[5px] items-start max-w-[inherit] relative w-full">
          <Div3 />
        </div>
      </div>
    </div>
  );
}

export default function Container() {
  return (
    <div className="bg-white content-stretch flex gap-[10px] items-start px-[12px] py-[20px] relative size-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[rgba(0,0,0,0.1)] border-b border-solid inset-0 pointer-events-none" />
      <Frame />
      <Container7 />
    </div>
  );
}