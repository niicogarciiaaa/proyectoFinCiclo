<?php
/**
 * FPDF - Minimal implementation for PDF generation
 * Based on FPDF 1.86 by Olivier Plathey
 * This is a minimal implementation for basic PDF generation
 */

if(!class_exists('FPDF')) {
    define('FPDF_VERSION','1.86');

    class FPDF {
        protected $page = 0;
        protected $n = 2;
        protected $buffer = '';
        protected $pages = array();
        protected $state = 0;
        protected $compress = true;
        protected $k;
        protected $DefOrientation;
        protected $CurOrientation;
        protected $StdPageSizes;
        protected $DefPageSize;
        protected $CurPageSize;
        protected $CurRotation;
        protected $PageInfo;
        protected $wPt, $hPt;
        protected $w, $h;
        protected $lMargin;
        protected $tMargin;
        protected $rMargin;
        protected $bMargin;
        protected $cMargin;
        protected $x, $y;
        protected $lasth;
        protected $LineWidth;
        protected $fontpath;
        protected $CoreFonts;
        protected $fonts;
        protected $FontFiles;
        protected $encodings;
        protected $cmaps;
        protected $FontFamily;
        protected $FontStyle;
        protected $underline;
        protected $CurrentFont;
        protected $FontSizePt;
        protected $FontSize;
        protected $DrawColor;
        protected $FillColor;
        protected $TextColor;
        protected $ColorFlag;
        protected $WithAlpha;
        protected $ws;
        protected $images;
        protected $PageLinks;
        protected $links;
        protected $InHeader;
        protected $InFooter;
        protected $AliasNbPages;
        protected $ZoomMode;
        protected $LayoutMode;
        protected $metadata;
        protected $PDFVersion;

        function __construct($orientation='P', $unit='mm', $size='A4') {
            $this->StdPageSizes = array('a3'=>array(841.89,1190.55), 'a4'=>array(595.28,841.89), 'a5'=>array(420.94,595.28),
                'letter'=>array(612,792), 'legal'=>array(612,1008));
            $this->DefOrientation = strtoupper($orientation[0]);
            $this->CurOrientation = $this->DefOrientation;
            if($unit=='pt') $this->k = 1;
            elseif($unit=='mm') $this->k = 72/25.4;
            elseif($unit=='cm') $this->k = 72/2.54;
            elseif($unit=='in') $this->k = 72;
            else $this->Error('Incorrect unit: '.$unit);
            
            if(is_string($size)) {
                $size = strtolower($size);
                if(!isset($this->StdPageSizes[$size]))
                    $this->Error('Unknown page size: '.$size);
                $a = $this->StdPageSizes[$size];
                $this->DefPageSize = array($a[0]/$this->k, $a[1]/$this->k);
            } else {
                $this->DefPageSize = $size;
            }
            $this->CurPageSize = $this->DefPageSize;
            $this->CurRotation = 0;
            $this->PageInfo = array();
            $this->lMargin = 28.35/$this->k;
            $this->tMargin = 28.35/$this->k;
            $this->rMargin = 28.35/$this->k;
            $this->bMargin = 28.35/$this->k;
            $this->cMargin = $this->lMargin/10;
            $this->x = $this->lMargin;
            $this->y = $this->tMargin;
            $this->lasth = 0;
            $this->LineWidth = .567/$this->k;
            $this->fontpath = dirname(__FILE__).'/font/';
            $this->CoreFonts = array('courier', 'helvetica', 'times', 'symbol', 'zapfdingbats');
            $this->fonts = array();
            $this->FontFiles = array();
            $this->encodings = array();
            $this->cmaps = array();
            $this->FontFamily = '';
            $this->FontStyle = '';
            $this->FontSizePt = 12;
            $this->underline = false;
            $this->DrawColor = '0 G';
            $this->FillColor = '0 g';
            $this->TextColor = '0 g';
            $this->ColorFlag = false;
            $this->WithAlpha = false;
            $this->ws = 0;
            $this->images = array();
            $this->PageLinks = array();
            $this->links = array();
            $this->InHeader = false;
            $this->InFooter = false;
            $this->AliasNbPages = '{nb}';
            $this->ZoomMode = 'default';
            $this->LayoutMode = 'default';
            $this->metadata = array();
            $this->PDFVersion = '1.3';
        }

        function SetMargins($left, $top, $right=null) {
            $this->lMargin = $left;
            $this->tMargin = $top;
            if($right===null) $right = $left;
            $this->rMargin = $right;
        }

        function SetLeftMargin($margin) {
            $this->lMargin = $margin;
            if($this->page>0 && $this->x<$margin) $this->x = $margin;
        }

        function SetTopMargin($margin) {
            $this->tMargin = $margin;
        }

        function SetRightMargin($margin) {
            $this->rMargin = $margin;
        }

        function SetAutoPageBreak($auto, $margin=0) {
            $this->bMargin = $margin;
        }

        function SetDisplayMode($zoom, $layout='default') {
            $this->ZoomMode = $zoom;
            $this->LayoutMode = $layout;
        }

        function SetCompression($compress) {
            $this->compress = $compress;
        }

        function SetTitle($title, $isUTF8=false) {
            $this->metadata['Title'] = $isUTF8 ? $title : utf8_encode($title);
        }

        function SetAuthor($author, $isUTF8=false) {
            $this->metadata['Author'] = $isUTF8 ? $author : utf8_encode($author);
        }

        function SetSubject($subject, $isUTF8=false) {
            $this->metadata['Subject'] = $isUTF8 ? $subject : utf8_encode($subject);
        }

        function SetKeywords($keywords, $isUTF8=false) {
            $this->metadata['Keywords'] = $isUTF8 ? $keywords : utf8_encode($keywords);
        }

        function SetCreator($creator, $isUTF8=false) {
            $this->metadata['Creator'] = $isUTF8 ? $creator : utf8_encode($creator);
        }

        function Error($msg) {
            throw new Exception('FPDF error: '.$msg);
        }

        function Open() {
            $this->state = 1;
        }

        function Close() {
            if($this->state==3) return;
            if($this->page==0) $this->AddPage();
            $this->InFooter = true;
            $this->Footer();
            $this->InFooter = false;
            $this->_endpage();
            $this->_enddoc();
        }

        function AddPage($orientation='', $size='', $rotation=0) {
            if($this->state==3) $this->Error('The document is closed');
            $family = $this->FontFamily;
            $style = $this->FontStyle.($this->underline ? 'U' : '');
            $fontsize = $this->FontSizePt;
            $lw = $this->LineWidth;
            $dc = $this->DrawColor;
            $fc = $this->FillColor;
            $tc = $this->TextColor;
            $cf = $this->ColorFlag;
            if($this->page>0) {
                $this->InFooter = true;
                $this->Footer();
                $this->InFooter = false;
                $this->_endpage();
            }
            $this->_beginpage($orientation, $size, $rotation);
            $this->_out('2 J');
            $this->LineWidth = $lw;
            $this->_out(sprintf('%.2F w',$lw*$this->k));
            if($family) $this->SetFont($family,$style,$fontsize);
            $this->DrawColor = $dc;
            if($dc!='0 G') $this->_out($dc);
            $this->FillColor = $fc;
            if($fc!='0 g') $this->_out($fc);
            $this->TextColor = $tc;
            $this->ColorFlag = $cf;
            $this->InHeader = true;
            $this->Header();
            $this->InHeader = false;
            if($this->LineWidth!=$lw) {
                $this->LineWidth = $lw;
                $this->_out(sprintf('%.2F w',$lw*$this->k));
            }
            if($family) $this->SetFont($family,$style,$fontsize);
            if($this->DrawColor!=$dc) {
                $this->DrawColor = $dc;
                $this->_out($dc);
            }
            if($this->FillColor!=$fc) {
                $this->FillColor = $fc;
                $this->_out($fc);
            }
            $this->TextColor = $tc;
            $this->ColorFlag = $cf;
        }

        function Header() {
            // To be implemented in your own class
        }

        function Footer() {
            // To be implemented in your own class
        }

        function PageNo() {
            return $this->page;
        }

        function GetX() {
            return $this->x;
        }

        function SetX($x) {
            if($x>=0) $this->x = $x;
            else $this->x = $this->w+$x;
        }

        function GetY() {
            return $this->y;
        }

        function SetY($y, $resetX=true) {
            if($resetX) $this->x = $this->lMargin;
            if($y>=0) $this->y = $y;
            else $this->y = $this->h+$y;
        }

        function SetXY($x, $y) {
            $this->SetX($x);
            $this->SetY($y, false);
        }

        function SetDrawColor($r, $g=null, $b=null) {
            if(($r==0 && $g==0 && $b==0) || $g===null)
                $this->DrawColor = sprintf('%.3F G',$r/255);
            else
                $this->DrawColor = sprintf('%.3F %.3F %.3F RG',$r/255,$g/255,$b/255);
            if($this->page>0) $this->_out($this->DrawColor);
        }

        function SetFillColor($r, $g=null, $b=null) {
            if(($r==0 && $g==0 && $b==0) || $g===null)
                $this->FillColor = sprintf('%.3F g',$r/255);
            else
                $this->FillColor = sprintf('%.3F %.3F %.3F rg',$r/255,$g/255,$b/255);
            $this->ColorFlag = ($this->FillColor!=$this->TextColor);
            if($this->page>0) $this->_out($this->FillColor);
        }

        function SetTextColor($r, $g=null, $b=null) {
            if(($r==0 && $g==0 && $b==0) || $g===null)
                $this->TextColor = sprintf('%.3F g',$r/255);
            else
                $this->TextColor = sprintf('%.3F %.3F %.3F rg',$r/255,$g/255,$b/255);
            $this->ColorFlag = ($this->FillColor!=$this->TextColor);
        }

        function GetStringWidth($s) {
            $s = (string)$s;
            $cw = &$this->CurrentFont['cw'];
            $w = 0;
            $l = strlen($s);
            for($i=0; $i<$l; $i++)
                $w += $cw[$s[$i]];
            return $w*$this->FontSize/1000;
        }

        function SetLineWidth($width) {
            $this->LineWidth = $width;
            if($this->page>0) $this->_out(sprintf('%.2F w',$width*$this->k));
        }

        function Line($x1, $y1, $x2, $y2) {
            $this->_out(sprintf('%.2F %.2F m %.2F %.2F l S',$x1*$this->k,($this->h-$y1)*$this->k,$x2*$this->k,($this->h-$y2)*$this->k));
        }

        function Rect($x, $y, $w, $h, $style='') {
            if($style=='F')
                $op = 'f';
            elseif($style=='FD' || $style=='DF')
                $op = 'B';
            else
                $op = 'S';
            $this->_out(sprintf('%.2F %.2F %.2F %.2F re %s',$x*$this->k,($this->h-$y)*$this->k,$w*$this->k,-$h*$this->k,$op));
        }

        function SetFont($family, $style='', $size=0) {
            if($family=='') $family = $this->FontFamily;
            else $family = strtolower($family);
            $style = strtoupper($style);
            if(strpos($style,'U')!==false) {
                $this->underline = true;
                $style = str_replace('U','',$style);
            } else {
                $this->underline = false;
            }
            if($style=='IB') $style = 'BI';
            if($size==0) $size = $this->FontSizePt;
            if($this->FontFamily==$family && $this->FontStyle==$style && $this->FontSizePt==$size)
                return;
            $fontkey = $family.$style;
            if(!isset($this->fonts[$fontkey])) {
                if($family=='arial') $family = 'helvetica';
                if(in_array($family,$this->CoreFonts)) {
                    if($family=='symbol' || $family=='zapfdingbats') $style = '';
                    $fontkey = $family.$style;
                    if(!isset($this->fonts[$fontkey]))
                        $this->AddFont($family,$style);
                } else {
                    $this->Error('Undefined font: '.$family.' '.$style);
                }
            }
            $this->FontFamily = $family;
            $this->FontStyle = $style;
            $this->FontSizePt = $size;
            $this->FontSize = $size/$this->k;
            $this->CurrentFont = &$this->fonts[$fontkey];
            if($this->page>0) $this->_out(sprintf('BT /F%d %.2F Tf ET',$this->CurrentFont['i'],$this->FontSizePt));
        }

        function AddFont($family, $style='') {
            $family = strtolower($family);
            if($family=='arial') $family = 'helvetica';
            $style = strtoupper($style);
            if($style=='IB') $style = 'BI';
            $fontkey = $family.$style;
            if(isset($this->fonts[$fontkey])) return;
            $i = count($this->fonts)+1;
            $name = $family;
            if($family=='times' || $family=='helvetica' || $family=='courier') {
                if($style!='') $name .= '-';
                if($style=='B') $name .= 'Bold';
                elseif($style=='I') $name .= 'Oblique';
                elseif($style=='BI') $name .= 'BoldOblique';
            }
            $cw = array();
            for($c=0; $c<=255; $c++) $cw[chr($c)] = 600;
            $this->fonts[$fontkey] = array('i'=>$i, 'type'=>'core', 'name'=>$name, 'up'=>-100, 'ut'=>50, 'cw'=>$cw);
        }

        function Text($x, $y, $txt) {
            if(!isset($this->CurrentFont))
                $this->Error('No font has been set');
            $s = sprintf('BT %.2F %.2F Td (%s) Tj ET',$x*$this->k,($this->h-$y)*$this->k,$this->_escape($txt));
            if($this->underline && $txt!='')
                $s .= ' '.$this->_dounderline($x,$y,$txt);
            if($this->ColorFlag)
                $s = 'q '.$this->TextColor.' '.$s.' Q';
            $this->_out($s);
        }

        function Cell($w, $h=0, $txt='', $border=0, $ln=0, $align='', $fill=false, $link='') {
            $k = $this->k;
            if($this->y+$h>$this->bMargin && !$this->InHeader && !$this->InFooter && $this->AcceptPageBreak()) {
                $x = $this->x;
                $ws = $this->ws;
                if($ws>0) {
                    $this->ws = 0;
                    $this->_out('0 Tw');
                }
                $this->AddPage($this->CurOrientation,$this->CurPageSize,$this->CurRotation);
                $this->x = $x;
                if($ws>0) {
                    $this->ws = $ws;
                    $this->_out(sprintf('%.3F Tw',$ws*$k));
                }
            }
            if($w==0) $w = $this->w-$this->rMargin-$this->x;
            $s = '';
            if($fill || $border==1) {
                if($fill)
                    $op = ($border==1) ? 'B' : 'f';
                else
                    $op = 'S';
                $s = sprintf('%.2F %.2F %.2F %.2F re %s ',$this->x*$k,($this->h-$this->y)*$k,$w*$k,-$h*$k,$op);
            }
            if(is_string($border)) {
                $x = $this->x;
                $y = $this->y;
                if(strpos($border,'L')!==false)
                    $s .= sprintf('%.2F %.2F m %.2F %.2F l S ',$x*$k,($this->h-$y)*$k,$x*$k,($this->h-($y+$h))*$k);
                if(strpos($border,'T')!==false)
                    $s .= sprintf('%.2F %.2F m %.2F %.2F l S ',$x*$k,($this->h-$y)*$k,($x+$w)*$k,($this->h-$y)*$k);
                if(strpos($border,'R')!==false)
                    $s .= sprintf('%.2F %.2F m %.2F %.2F l S ',($x+$w)*$k,($this->h-$y)*$k,($x+$w)*$k,($this->h-($y+$h))*$k);
                if(strpos($border,'B')!==false)
                    $s .= sprintf('%.2F %.2F m %.2F %.2F l S ',$x*$k,($this->h-($y+$h))*$k,($x+$w)*$k,($this->h-($y+$h))*$k);
            }
            if($txt!=='') {
                if(!isset($this->CurrentFont))
                    $this->Error('No font has been set');
                if($align=='R')
                    $dx = $w-$this->cMargin-$this->GetStringWidth($txt);
                elseif($align=='C')
                    $dx = ($w-$this->GetStringWidth($txt))/2;
                else
                    $dx = $this->cMargin;
                if($this->ColorFlag)
                    $s .= 'q '.$this->TextColor.' ';
                $s .= sprintf('BT %.2F %.2F Td (%s) Tj ET',($this->x+$dx)*$k,($this->h-($this->y+.5*$h+.3*$this->FontSize))*$k,$this->_escape($txt));
                if($this->underline)
                    $s .= ' '.$this->_dounderline($this->x+$dx,$this->y+.5*$h+.3*$this->FontSize,$txt);
                if($this->ColorFlag)
                    $s .= ' Q';
            }
            if($s) $this->_out($s);
            $this->lasth = $h;
            if($ln>0) {
                $this->y += $h;
                if($ln==1) $this->x = $this->lMargin;
            } else {
                $this->x += $w;
            }
        }

        function Ln($h=null) {
            $this->x = $this->lMargin;
            if($h===null)
                $this->y += $this->lasth;
            else
                $this->y += $h;
        }

        function MultiCell($w, $h, $txt, $border=0, $align='J', $fill=false) {
            if(!isset($this->CurrentFont))
                $this->Error('No font has been set');
            $cw = &$this->CurrentFont['cw'];
            if($w==0) $w = $this->w-$this->rMargin-$this->x;
            $wmax = ($w-2*$this->cMargin)*1000/$this->FontSize;
            $s = str_replace("\r",'',(string)$txt);
            $nb = strlen($s);
            if($nb>0 && $s[$nb-1]=="\n") $nb--;
            $b = 0;
            if($border) {
                if($border==1) {
                    $border = 'LTRB';
                    $b = 'LRT';
                    $b2 = 'LR';
                } else {
                    $b2 = '';
                    if(strpos($border,'L')!==false) $b2 .= 'L';
                    if(strpos($border,'R')!==false) $b2 .= 'R';
                    $b = (strpos($border,'T')!==false) ? $b2.'T' : $b2;
                }
            }
            $sep = -1;
            $i = 0;
            $j = 0;
            $l = 0;
            $ns = 0;
            $nl = 1;
            while($i<$nb) {
                $c = $s[$i];
                if($c=="\n") {
                    if($this->ws>0) {
                        $this->ws = 0;
                        $this->_out('0 Tw');
                    }
                    $this->Cell($w,$h,substr($s,$j,$i-$j),$b,2,$align,$fill);
                    $i++;
                    $sep = -1;
                    $j = $i;
                    $l = 0;
                    $ns = 0;
                    $nl++;
                    if($border && $nl==2) $b = $b2;
                    continue;
                }
                if($c==' ') {
                    $sep = $i;
                    $ls = $l;
                    $ns++;
                }
                $l += $cw[$c];
                if($l>$wmax) {
                    if($sep==-1) {
                        if($i==$j) $i++;
                        if($this->ws>0) {
                            $this->ws = 0;
                            $this->_out('0 Tw');
                        }
                        $this->Cell($w,$h,substr($s,$j,$i-$j),$b,2,$align,$fill);
                    } else {
                        if($align=='J') {
                            $this->ws = ($ns>1) ? ($wmax-$ls)/1000*$this->FontSize/($ns-1) : 0;
                            $this->_out(sprintf('%.3F Tw',$this->ws*$this->k));
                        }
                        $this->Cell($w,$h,substr($s,$j,$sep-$j),$b,2,$align,$fill);
                        $i = $sep+1;
                    }
                    $sep = -1;
                    $j = $i;
                    $l = 0;
                    $ns = 0;
                    $nl++;
                    if($border && $nl==2) $b = $b2;
                } else {
                    $i++;
                }
            }
            if($this->ws>0) {
                $this->ws = 0;
                $this->_out('0 Tw');
            }
            if($border && strpos($border,'B')!==false) $b .= 'B';
            $this->Cell($w,$h,substr($s,$j,$i-$j),$b,2,$align,$fill);
            $this->x = $this->lMargin;
        }

        function Output($dest='', $name='', $isUTF8=false) {
            if($this->state<3) $this->Close();
            $dest = strtoupper($dest);
            if($dest=='') {
                if($name=='') {
                    $name = 'doc.pdf';
                    $dest = 'I';
                } else {
                    $dest = 'F';
                }
            }
            if($dest=='I') {
                $this->_checkoutput();
                if(PHP_SAPI!='cli') {
                    if(headers_sent($file,$line))
                        $this->Error("Some data has already been output, can't send PDF file (output started at $file:$line)");
                    header('Content-Type: application/pdf');
                    header('Content-Disposition: inline; filename="'.$name.'"');
                    header('Cache-Control: private, max-age=0, must-revalidate');
                    header('Pragma: public');
                }
                echo $this->buffer;
            } elseif($dest=='D') {
                $this->_checkoutput();
                if(headers_sent($file,$line))
                    $this->Error("Some data has already been output, can't send PDF file (output started at $file:$line)");
                header('Content-Type: application/pdf');
                header('Content-Disposition: attachment; filename="'.$name.'"');
                header('Cache-Control: private, max-age=0, must-revalidate');
                header('Pragma: public');
                echo $this->buffer;
            } elseif($dest=='F') {
                if(!$isUTF8) $name = utf8_decode($name);
                $f = fopen($name,'wb');
                if(!$f) $this->Error('Unable to create output file: '.$name);
                fwrite($f,$this->buffer,strlen($this->buffer));
                fclose($f);
            } elseif($dest=='S') {
                return $this->buffer;
            } else {
                $this->Error('Incorrect output destination: '.$dest);
            }
            return '';
        }

        protected function _dochecks() {
            if(PHP_VERSION<'5.1.0')
                $this->Error('PHP 5.1.0 or above is required');
        }

        protected function _checkoutput() {
            if(PHP_SAPI!='cli') {
                if(headers_sent($file,$line))
                    $this->Error("Some data has already been output, can't send PDF file (output started at $file:$line)");
            }
            if(ob_get_length()) {
                if(preg_match('/^(\xEF\xBB\xBF)?\s*$/',ob_get_contents())) {
                    ob_end_clean();
                } else {
                    $this->Error("Some data has already been output, can't send PDF file");
                }
            }
        }

        protected function _getpagesize($size) {
            if(is_string($size)) {
                $size = strtolower($size);
                if(!isset($this->StdPageSizes[$size]))
                    $this->Error('Unknown page size: '.$size);
                $a = $this->StdPageSizes[$size];
                return array($a[0]/$this->k, $a[1]/$this->k);
            } else {
                if($size[0]>$size[1])
                    return array($size[1], $size[0]);
                else
                    return $size;
            }
        }

        protected function _beginpage($orientation, $size, $rotation) {
            $this->page++;
            $this->pages[$this->page] = '';
            $this->state = 2;
            $this->x = $this->lMargin;
            $this->y = $this->tMargin;
            $this->FontFamily = '';
            if(!$orientation) $orientation = $this->DefOrientation;
            else $orientation = strtoupper($orientation[0]);
            if(!$size) $size = $this->DefPageSize;
            else $size = $this->_getpagesize($size);
            if($orientation!=$this->CurOrientation || $size[0]!=$this->CurPageSize[0] || $size[1]!=$this->CurPageSize[1]) {
                if($orientation=='P') {
                    $this->w = $size[0];
                    $this->h = $size[1];
                } else {
                    $this->w = $size[1];
                    $this->h = $size[0];
                }
                $this->wPt = $this->w*$this->k;
                $this->hPt = $this->h*$this->k;
                $this->PageBreakTrigger = $this->h-$this->bMargin;
                $this->CurOrientation = $orientation;
                $this->CurPageSize = $size;
            }
            if($orientation!=$this->DefOrientation || $size[0]!=$this->DefPageSize[0] || $size[1]!=$this->DefPageSize[1])
                $this->PageInfo[$this->page]['size'] = array($this->wPt, $this->hPt);
            if($rotation!=0) {
                if($rotation%90!=0)
                    $this->Error('Incorrect rotation value: '.$rotation);
                $this->CurRotation = $rotation;
                $this->PageInfo[$this->page]['rotation'] = $rotation;
            }
        }

        protected function _endpage() {
            $this->state = 1;
        }

        protected function _escape($s) {
            $s = str_replace('\\','\\\\',$s);
            $s = str_replace('(','\\(',$s);
            $s = str_replace(')','\\)',$s);
            $s = str_replace("\r",'\\r',$s);
            return $s;
        }

        protected function _dounderline($x, $y, $txt) {
            $up = $this->CurrentFont['up'];
            $ut = $this->CurrentFont['ut'];
            $w = $this->GetStringWidth($txt)+$this->ws*substr_count($txt,' ');
            return sprintf('%.2F %.2F %.2F %.2F re f',$x*$this->k,($this->h-($y-$up/1000*$this->FontSize))*$this->k,$w*$this->k,-$ut/1000*$this->FontSizePt);
        }

        protected function _out($s) {
            if($this->state==2)
                $this->pages[$this->page] .= $s."\n";
            elseif($this->state==1)
                $this->_put($s);
            elseif($this->state==0)
                $this->Error('No page has been added yet');
            elseif($this->state==3)
                $this->Error('The document is closed');
        }

        protected function _put($s) {
            $this->buffer .= $s."\n";
        }

        protected function _newobj($n=null) {
            if($n===null) {
                $n = ++$this->n;
            } else {
                $this->n = max($this->n, $n);
            }
            $this->offsets[$n] = strlen($this->buffer);
            $this->_put($n.' 0 obj');
            return $n;
        }

        protected function _putstream($data) {
            $this->_put('stream');
            $this->_put($data);
            $this->_put('endstream');
        }

        protected function _enddoc() {
            $this->state = 3;
            $this->_putfonts();
            $this->_putresources();
            $this->offsets = array();
            $this->_put('%PDF-1.3');
            $this->_put('1 0 obj');
            $this->_put('<<');
            $this->_put('/Type /Catalog');
            $this->_put('/Pages 2 0 R');
            $this->_put('>>');
            $this->_put('endobj');
            $this->_put('2 0 obj');
            $this->_put('<<');
            $this->_put('/Type /Pages');
            $this->_put('/Kids [');
            for($i=1;$i<=$this->page;$i++) {
                $this->_put((3+2*($i-1)).' 0 R');
            }
            $this->_put(']');
            $this->_put('/Count '.$this->page);
            $this->_put('>>');
            $this->_put('endobj');
            for($n=1;$n<=$this->page;$n++) {
                $this->_putpage($n);
            }
            $this->_puttrailer();
        }

        protected function _putfonts() {
            foreach($this->fonts as $k => $font) {
                $this->_newobj();
                $this->fonts[$k]['n'] = $this->n;
                $this->_put('<<');
                $this->_put('/Type /Font');
                $this->_put('/BaseFont /'.$font['name']);
                $this->_put('/Subtype /Type1');
                if($font['name']!='Symbol' && $font['name']!='ZapfDingbats')
                    $this->_put('/Encoding /WinAnsiEncoding');
                $this->_put('>>');
                $this->_put('endobj');
            }
        }

        protected function _putresources() {
            // Resources will be written by _putpage
        }

        protected function _putpage($n) {
            $this->_newobj();
            $this->_put('<<');
            $this->_put('/Type /Page');
            $this->_put('/Parent 2 0 R');
            if(isset($this->PageInfo[$n]['size']))
                $this->_put(sprintf('/MediaBox [0 0 %.2F %.2F]',$this->PageInfo[$n]['size'][0],$this->PageInfo[$n]['size'][1]));
            $this->_put('/Resources <<');
            $this->_put('/ProcSet [/PDF /Text]');
            $this->_put('/Font <<');
            foreach($this->fonts as $font) {
                $this->_put('/F'.$font['i'].' '.$font['n'].' 0 R');
            }
            $this->_put('>>');
            $this->_put('>>');
            if(isset($this->PageInfo[$n]['rotation']))
                $this->_put('/Rotate '.$this->PageInfo[$n]['rotation']);
            $this->_put('/Contents '.($this->n+1).' 0 R');
            $this->_put('>>');
            $this->_put('endobj');
            $this->_newobj();
            $p = $this->pages[$n];
            $this->_put('<<');
            $this->_put('/Length '.strlen($p));
            $this->_put('>>');
            $this->_putstream($p);
            $this->_put('endobj');
        }

        protected function _puttrailer() {
            $this->_put('xref');
            $this->_put('0 '.($this->n+1));
            $this->_put('0000000000 65535 f ');
            foreach($this->offsets as $offset) {
                $this->_put(sprintf('%010d 00000 n ',$offset));
            }
            $this->_put('trailer');
            $this->_put('<<');
            $this->_put('/Size '.($this->n+1));
            $this->_put('/Root 1 0 R');
            $this->_put('/Info 3 0 R');
            $this->_put('>>');
            $this->_put('startxref');
            $offset = strlen($this->buffer);
            $this->_put($offset);
            $this->_put('%%EOF');
            $this->state = 3;
        }

        protected function AcceptPageBreak() {
            return true;
        }
    }
}
?>
